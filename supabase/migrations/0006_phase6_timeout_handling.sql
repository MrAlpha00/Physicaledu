-- Phase 6 — secure, idempotent match timeout finalisation.
--
-- This migration is required so a scheduler (or the lazy server-side fallback)
-- can finalise abandoned matches without attributing a fake player move.
-- It is additive: no table is dropped, no existing record is rewritten and no
-- RLS policy is weakened. Execute after 0005 on clean or already-migrated DBs.

create index if not exists game_matches_timeout_idx
  on public.game_matches (status, updated_at desc)
  where status in ('waiting', 'countdown', 'active');

create or replace function public.phase5_finalize_timeout(
  p_public_id text,
  p_outcome jsonb,
  p_reason text,
  p_actor integer default 0,
  p_clock_expired boolean default false,
  p_grace_minutes integer default null,
  p_apply_rating boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.game_matches;
  v_grace integer;
  v_kind text;
  v_winner integer;
  v_new_version integer;
  v_new_seq integer;
  v_state jsonb;
  v_apply_rating boolean := false;
  v_k_factor integer := 32;
  v_start integer := 1200;
  v_season text := 'all-time';
  v_user_a uuid;
  v_user_b uuid;
  v_rating_a integer;
  v_rating_b integer;
  v_expected_a double precision;
  v_expected_b double precision;
  v_score_a double precision;
  v_score_b double precision;
  v_delta_a integer;
  v_delta_b integer;
  v_recipient uuid;
begin
  -- Never callable through the publishable key or a browser session.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role access required';
  end if;

  select * into v_match from public.game_matches
    where public_id = p_public_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found', 'publicId', p_public_id);
  end if;

  if v_match.status not in ('waiting', 'countdown', 'active') then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_open', 'publicId', p_public_id);
  end if;

  -- The primary idempotency guard. A match has at most one final result row.
  if exists (select 1 from public.game_match_results where match_id = v_match.id) then
    return jsonb_build_object('status', 'skipped', 'reason', 'already_finalised', 'publicId', p_public_id);
  end if;

  select reconnection_grace_minutes into v_grace
    from public.game_settings where game_slug = v_match.game_slug;
  v_grace := coalesce(p_grace_minutes, v_grace, 5);
  v_grace := greatest(1, least(v_grace, 1440));

  -- Chess clocks may flag before the reconnection grace elapses; other games
  -- require the inactivity grace period to have passed.
  if not coalesce(p_clock_expired, false)
     and v_match.updated_at > now() - make_interval(mins => v_grace) then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_expired', 'publicId', p_public_id);
  end if;

  v_kind := coalesce(p_outcome ->> 'kind', '');
  if v_kind not in ('win', 'draw') then
    raise exception 'Timeout outcome must be a win or draw';
  end if;
  v_winner := (p_outcome ->> 'winner')::integer;
  if v_kind = 'win' and v_winner not in (0, 1) then
    raise exception 'A win outcome requires a valid winner index';
  end if;
  if p_actor not in (0, 1) then
    raise exception 'Invalid timeout actor index';
  end if;

  v_new_version := v_match.version + 1;
  v_new_seq := v_match.server_seq + 1;
  v_state := jsonb_set(
    jsonb_set(coalesce(v_match.state, '{}'::jsonb), '{status}', '"completed"'::jsonb),
    '{outcome}', coalesce(p_outcome, 'null'::jsonb)
  );

  insert into public.game_match_actions
    (match_id, player_index, seq, expected_version, action_type, payload)
  values
    (v_match.id, p_actor, v_new_seq, v_match.version, 'timeout',
      jsonb_build_object('reason', coalesce(p_reason, 'Timeout'), 'clockExpired', coalesce(p_clock_expired, false)))
  on conflict (match_id, seq) do nothing;

  insert into public.game_match_state_snapshots (match_id, version, state)
  values (v_match.id, v_new_version, v_state)
  on conflict do nothing;

  update public.game_matches set
    state = v_state,
    version = v_new_version,
    server_seq = v_new_seq,
    status = 'completed',
    outcome = p_outcome,
    ended_at = now(),
    updated_at = now()
  where id = v_match.id;

  insert into public.game_match_results
    (match_id, game_slug, mode, winner_index, outcome, rating_applied)
  values
    (v_match.id, v_match.game_slug, v_match.mode, v_winner, p_outcome, false)
  on conflict (match_id) do nothing;

  -- Ratings are applied only to ranked results with a definite winner or draw,
  -- never to abandoned/no-result timeouts, and never twice for one match.
  v_apply_rating := coalesce(p_apply_rating, true)
    and v_match.mode = 'ranked'
    and not exists (
      select 1 from public.match_disputes
      where match_id = v_match.id and status in ('open', 'reviewing')
    )
    and not exists (
      select 1 from public.game_rating_history where match_id = v_match.id
    );

  if v_apply_rating then
    select user_id into v_user_a from public.game_match_players
      where match_id = v_match.id and player_index = 0;
    select user_id into v_user_b from public.game_match_players
      where match_id = v_match.id and player_index = 1;

    v_apply_rating := v_user_a is not null and v_user_b is not null
      and not public.phase5_is_restricted(v_user_a, 'ranked', v_match.game_slug)
      and not public.phase5_is_restricted(v_user_b, 'ranked', v_match.game_slug);
  end if;

  if v_apply_rating then
    select k_factor, starting_rating, season_key
      into v_k_factor, v_start, v_season
      from public.game_settings where game_slug = v_match.game_slug;
    v_k_factor := coalesce(v_k_factor, 32);
    v_start := coalesce(v_start, 1200);
    v_season := coalesce(v_season, 'all-time');

    select r.rating into v_rating_a from public.game_ratings r
      where r.user_id = v_user_a and r.game_slug = v_match.game_slug and r.season_key = v_season;
    select r.rating into v_rating_b from public.game_ratings r
      where r.user_id = v_user_b and r.game_slug = v_match.game_slug and r.season_key = v_season;
    v_rating_a := coalesce(v_rating_a, v_start);
    v_rating_b := coalesce(v_rating_b, v_start);

    v_expected_a := 1.0 / (1.0 + power(10.0::double precision, (v_rating_b - v_rating_a)::double precision / 400.0));
    v_expected_b := 1.0 - v_expected_a;
    v_score_a := case when v_kind = 'draw' then 0.5 when v_winner = 0 then 1.0 else 0.0 end;
    v_score_b := case when v_kind = 'draw' then 0.5 when v_winner = 1 then 1.0 else 0.0 end;
    v_delta_a := round(v_k_factor::double precision * (v_score_a - v_expected_a))::integer;
    v_delta_b := round(v_k_factor::double precision * (v_score_b - v_expected_b))::integer;

    insert into public.game_rating_history
      (user_id, game_slug, match_id, season_key, before_rating, after_rating, delta, outcome, reason)
    values
      (v_user_a, v_match.game_slug, v_match.id, v_season, v_rating_a, v_rating_a + v_delta_a, v_delta_a,
        case when v_kind = 'draw' then 'draw' when v_winner = 0 then 'win' else 'loss' end, 'timeout'),
      (v_user_b, v_match.game_slug, v_match.id, v_season, v_rating_b, v_rating_b + v_delta_b, v_delta_b,
        case when v_kind = 'draw' then 'draw' when v_winner = 1 then 'win' else 'loss' end, 'timeout')
    on conflict do nothing;

    update public.game_ratings set
      rating = rating + v_delta_a,
      highest_rating = greatest(highest_rating, rating + v_delta_a),
      played = played + 1,
      wins = wins + case when v_kind <> 'draw' and v_winner = 0 then 1 else 0 end,
      losses = losses + case when v_kind <> 'draw' and v_winner = 1 then 1 else 0 end,
      draws = draws + case when v_kind = 'draw' then 1 else 0 end,
      last_played_at = now(), updated_at = now()
    where user_id = v_user_a and game_slug = v_match.game_slug and season_key = v_season;

    update public.game_ratings set
      rating = rating + v_delta_b,
      highest_rating = greatest(highest_rating, rating + v_delta_b),
      played = played + 1,
      wins = wins + case when v_kind <> 'draw' and v_winner = 1 then 1 else 0 end,
      losses = losses + case when v_kind <> 'draw' and v_winner = 0 then 1 else 0 end,
      draws = draws + case when v_kind = 'draw' then 1 else 0 end,
      last_played_at = now(), updated_at = now()
    where user_id = v_user_b and game_slug = v_match.game_slug and season_key = v_season;

    update public.game_match_players set
      rating_before = case when player_index = 0 then v_rating_a else v_rating_b end,
      rating_after = case when player_index = 0 then v_rating_a + v_delta_a else v_rating_b + v_delta_b end,
      rating_delta = case when player_index = 0 then v_delta_a else v_delta_b end
    where match_id = v_match.id;

    update public.game_match_results set rating_applied = true where match_id = v_match.id;
  end if;

  foreach v_recipient in array array[v_user_a, v_user_b] loop
    if v_recipient is not null then
      perform public.phase3_notify_user(
        v_recipient,
        'Match closed',
        'Your ' || v_match.game_slug || ' match was closed automatically: ' || coalesce(p_reason, 'timeout') || '.',
        'general', '/games/history', 'normal', null
      );
    end if;
  end loop;

  perform public.phase3_log(
    'phase5_match_timeout_finalised',
    'game_matches',
    v_match.id::text,
    jsonb_build_object(
      'publicId', v_match.public_id,
      'reason', coalesce(p_reason, 'Timeout'),
      'winner', v_winner,
      'ratingApplied', v_apply_rating
    )
  );

  return jsonb_build_object(
    'status', 'finalised',
    'publicId', v_match.public_id,
    'matchId', v_match.id,
    'winner', v_winner,
    'ratingApplied', v_apply_rating
  );
end;
$$;

revoke all on function public.phase5_finalize_timeout(text, jsonb, text, integer, boolean, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.phase5_finalize_timeout(text, jsonb, text, integer, boolean, integer, boolean)
  to service_role;

comment on function public.phase5_finalize_timeout is
  'Service-role-only, row-locked and idempotent timeout finalisation with at-most-once rating updates.';

-- Phase 6 scoped administration search. A single service-role RPC keeps the
-- wildcard construction in SQL and returns navigation identifiers only.
create or replace function public.phase6_admin_search(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean text := btrim(coalesce(p_query, ''));
  v_term text;
  v_href_term text;
  v_groups jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role access required';
  end if;

  v_clean := regexp_replace(v_clean, '[^a-zA-Z0-9 ._-]', '', 'g');
  v_clean := btrim(v_clean);
  if length(v_clean) < 2 then
    return jsonb_build_object('groups', '[]'::jsonb);
  end if;

  v_term := '%' || v_clean || '%';
  v_href_term := replace(regexp_replace(v_clean, '\s+', ' ', 'g'), ' ', '%20');

  select jsonb_build_array(
    jsonb_build_object(
      'type', 'student', 'label', 'Students',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'title', s.full_name, 'subtitle', s.usn,
          'href', '/admin/students?search=' || v_href_term
        ) order by s.full_name)
        from (
          select id, usn, full_name from public.student_directory
          where usn ilike v_term or full_name ilike v_term
          order by full_name limit 5
        ) s
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'type', 'event', 'label', 'Events',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id, 'title', e.name, 'subtitle', e.slug,
          'href', '/admin/events/' || e.id
        ) order by e.name)
        from (
          select id, name, slug from public.sports_events
          where name ilike v_term or slug ilike v_term
          order by name limit 5
        ) e
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'type', 'equipment', 'label', 'Equipment',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.name, 'subtitle', i.identification_number,
          'href', '/admin/equipment/' || i.id
        ) order by i.name)
        from (
          select id, name, identification_number from public.equipment_items
          where name ilike v_term or identification_number ilike v_term
          order by name limit 5
        ) i
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'type', 'game', 'label', 'Games',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.slug, 'title', g.name, 'subtitle', g.tagline,
          'href', '/games/' || g.slug
        ) order by g.sort_order, g.name)
        from (
          select slug, name, tagline, sort_order from public.game_catalog
          where name ilike v_term or short_name ilike v_term
          order by sort_order, name limit 5
        ) g
      ), '[]'::jsonb)
    )
  ) into v_groups;

  return jsonb_build_object('groups', v_groups);
end;
$$;

revoke all on function public.phase6_admin_search(text) from public, anon, authenticated;
grant execute on function public.phase6_admin_search(text) to service_role;
