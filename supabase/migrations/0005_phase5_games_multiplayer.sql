-- Phase 5 — six games, guest play, challenges, authoritative matches, ratings and moderation.
-- Additive only: no Phase 1-4 table or function is dropped or rewritten.
-- All privileged writes go through SECURITY DEFINER functions with pinned search_path.
-- Competitive action persistence is granted to service_role only: the Next.js
-- server action runs the authoritative TypeScript engine and is the sole caller.

create extension if not exists pgcrypto;

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

create table public.game_catalog (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (btrim(name) <> ''),
  short_name text not null,
  tagline text not null default '',
  description text not null default '',
  instructions text not null default '',
  rules jsonb not null default '[]'::jsonb,
  category text not null default 'Game',
  accent text not null default '#3564E9',
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  guest_enabled boolean not null default true,
  competitive_enabled boolean not null default true,
  challenge_enabled boolean not null default true,
  practice_enabled boolean not null default true,
  leaderboard_visible boolean not null default true,
  maintenance_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger game_catalog_set_updated_at before update on public.game_catalog
  for each row execute function public.set_updated_at();

create table public.game_settings (
  game_slug text primary key references public.game_catalog (slug) on delete cascade,
  starting_rating integer not null default 1200 check (starting_rating between 100 and 5000),
  k_factor integer not null default 32 check (k_factor between 8 and 128),
  chess_time_controls jsonb not null default '["unlimited","5","10","15"]'::jsonb,
  default_time_control text not null default '10',
  default_attempts integer not null default 10 check (default_attempts between 1 and 100),
  penalty_attempts integer not null default 5 check (penalty_attempts between 1 and 20),
  queen_value integer not null default 3 check (queen_value between 1 and 20),
  coin_value integer not null default 1 check (coin_value between 1 and 20),
  sudden_death boolean not null default true,
  challenge_expiry_minutes integer not null default 60 check (challenge_expiry_minutes between 5 and 10080),
  challenge_rate_limit integer not null default 8 check (challenge_rate_limit between 1 and 100),
  reconnection_grace_minutes integer not null default 5 check (reconnection_grace_minutes between 1 and 60),
  season_key text not null default 'all-time',
  season_label text not null default 'All time',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger game_settings_set_updated_at before update on public.game_settings
  for each row execute function public.set_updated_at();

create table public.game_achievement_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  title text not null,
  description text not null default '',
  game_slug text references public.game_catalog (slug) on delete cascade,
  criteria jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger game_achievement_rules_set_updated_at before update on public.game_achievement_rules
  for each row execute function public.set_updated_at();

/* -------------------------------------------------------------------------- */
/* Student gaming profiles and ratings                                         */
/* -------------------------------------------------------------------------- */

create table public.gaming_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gaming_name text not null check (btrim(gaming_name) between 2 and 40),
  gaming_name_key text not null unique check (gaming_name_key ~ '^[a-z0-9]+(?:[ _-][a-z0-9]+)*$'),
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  searchable boolean not null default true,
  challenges_enabled boolean not null default true,
  allowed_challengers uuid[] not null default array[]::uuid[],
  bio text,
  is_moderated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gaming_profiles_set_updated_at before update on public.gaming_profiles
  for each row execute function public.set_updated_at();

create table public.game_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_slug text not null references public.game_catalog (slug) on delete cascade,
  season_key text not null default 'all-time',
  rating integer not null default 1200,
  highest_rating integer not null default 1200,
  played integer not null default 0 check (played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  last_played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_slug, season_key)
);
create index game_ratings_leaderboard_idx
  on public.game_ratings (game_slug, season_key, rating desc, played desc);
create trigger game_ratings_set_updated_at before update on public.game_ratings
  for each row execute function public.set_updated_at();

/* -------------------------------------------------------------------------- */
/* Challenges                                                                  */
/* -------------------------------------------------------------------------- */

create table public.game_challenges (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.game_catalog (slug) on delete cascade,
  challenger_id uuid not null references auth.users (id) on delete cascade,
  opponent_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'rejected', 'cancelled', 'expired', 'match_created')),
  settings jsonb not null default '{}'::jsonb,
  message text,
  expires_at timestamptz not null,
  responded_at timestamptz,
  match_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_challenges_no_self check (challenger_id <> opponent_id)
);
create index game_challenges_pending_idx
  on public.game_challenges (opponent_id, status, created_at desc) where status = 'pending';
create index game_challenges_pair_idx
  on public.game_challenges (challenger_id, opponent_id, game_slug, created_at desc);
create unique index game_challenges_pending_pair_uidx
  on public.game_challenges (challenger_id, opponent_id, game_slug)
  where status = 'pending';
create trigger game_challenges_set_updated_at before update on public.game_challenges
  for each row execute function public.set_updated_at();

create table public.challenge_history (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.game_challenges (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index challenge_history_challenge_idx on public.challenge_history (challenge_id, created_at);

/* -------------------------------------------------------------------------- */
/* Matches — persistent, versioned, participant-only                           */
/* -------------------------------------------------------------------------- */

create table public.game_matches (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  game_slug text not null references public.game_catalog (slug) on delete restrict,
  mode text not null check (mode in ('practice', 'friendly', 'ranked')),
  status text not null default 'waiting' check (status in (
    'waiting', 'countdown', 'active', 'completed', 'cancelled', 'abandoned', 'disputed')),
  config jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  server_seq integer not null default 0 check (server_seq >= 0),
  outcome jsonb,
  challenge_id uuid references public.game_challenges (id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_matches_active_idx on public.game_matches (status, updated_at desc);
create index game_matches_game_idx on public.game_matches (game_slug, status, created_at desc);
create index game_matches_challenge_idx on public.game_matches (challenge_id);
create trigger game_matches_set_updated_at before update on public.game_matches
  for each row execute function public.set_updated_at();

create table public.game_match_players (
  match_id uuid not null references public.game_matches (id) on delete cascade,
  player_index integer not null check (player_index in (0, 1)),
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  ready boolean not null default false,
  connected boolean not null default true,
  rating_before integer,
  rating_after integer,
  rating_delta integer,
  joined_at timestamptz not null default now(),
  primary key (match_id, player_index)
);
create index game_match_players_user_idx on public.game_match_players (user_id, joined_at desc);
create unique index game_match_players_user_match_uidx
  on public.game_match_players (match_id, user_id) where user_id is not null;

create table public.game_match_actions (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.game_matches (id) on delete cascade,
  player_index integer not null check (player_index in (0, 1)),
  seq integer not null check (seq > 0),
  expected_version integer not null check (expected_version > 0),
  action_type text not null check (action_type ~ '^[a-z_]{2,40}$'),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint game_match_actions_seq_uidx unique (match_id, seq)
);
create index game_match_actions_match_idx on public.game_match_actions (match_id, seq);

create table public.game_match_state_snapshots (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.game_matches (id) on delete cascade,
  version integer not null check (version > 0),
  state jsonb not null,
  created_at timestamptz not null default now(),
  constraint game_match_snapshots_version_uidx unique (match_id, version)
);

create table public.game_match_results (
  match_id uuid primary key references public.game_matches (id) on delete cascade,
  game_slug text not null references public.game_catalog (slug) on delete restrict,
  mode text not null,
  winner_index integer check (winner_index in (0, 1)),
  outcome jsonb not null,
  rating_applied boolean not null default false,
  created_at timestamptz not null default now()
);
create index game_match_results_game_idx on public.game_match_results (game_slug, created_at desc);

/* -------------------------------------------------------------------------- */
/* Guest sessions — anonymous, no student identifiers                          */
/* -------------------------------------------------------------------------- */

create table public.guest_game_sessions (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text not null unique check (length(anonymous_id) between 16 and 128),
  game_slug text not null references public.game_catalog (slug) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index guest_game_sessions_expiry_idx on public.guest_game_sessions (expires_at);

create table public.guest_match_sessions (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid references public.guest_game_sessions (id) on delete cascade,
  game_slug text not null references public.game_catalog (slug) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create trigger guest_match_sessions_set_updated_at before update on public.guest_match_sessions
  for each row execute function public.set_updated_at();

/* -------------------------------------------------------------------------- */
/* Moderation                                                                  */
/* -------------------------------------------------------------------------- */

create table public.game_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  match_id uuid references public.game_matches (id) on delete set null,
  game_slug text references public.game_catalog (slug) on delete set null,
  reason text not null check (reason in (
    'abuse', 'cheating', 'harassment', 'inappropriate_name', 'dispute', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_reports_status_idx on public.game_reports (status, created_at desc);
create trigger game_reports_set_updated_at before update on public.game_reports
  for each row execute function public.set_updated_at();

create table public.match_disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.game_matches (id) on delete cascade,
  opened_by uuid not null references auth.users (id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 5 and 200),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  resolution text,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index match_disputes_status_idx on public.match_disputes (status, created_at desc);
create trigger match_disputes_set_updated_at before update on public.match_disputes
  for each row execute function public.set_updated_at();

create table public.gaming_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_slug text references public.game_catalog (slug) on delete cascade,
  restriction_type text not null check (restriction_type in ('all', 'ranked', 'challenge', 'public_profile')),
  reason text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gaming_restrictions_user_idx on public.gaming_restrictions (user_id, is_active, expires_at);

create table public.rating_adjustment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_slug text not null references public.game_catalog (slug) on delete cascade,
  before_rating integer not null,
  after_rating integer not null,
  delta integer not null,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  adjusted_by uuid not null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index rating_adjustment_history_user_idx on public.rating_adjustment_history (user_id, created_at desc);

/* -------------------------------------------------------------------------- */
/* Scoped helpers                                                              */
/* -------------------------------------------------------------------------- */

create or replace function public.phase5_is_admin()
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select public.is_pe_admin();
$$;

create or replace function public.phase5_is_match_participant(
  p_match_id uuid, p_user_id uuid default auth.uid()
)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.game_match_players
    where match_id = p_match_id and user_id = p_user_id
  );
$$;

create or replace function public.phase5_game_enabled(p_slug text, p_mode text default 'competitive')
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.game_catalog c
    where c.slug = p_slug and c.is_enabled and case
      when p_mode = 'guest' then c.guest_enabled
      when p_mode = 'practice' then c.practice_enabled
      when p_mode = 'challenge' then c.challenge_enabled
      else c.competitive_enabled
    end
  );
$$;

create or replace function public.phase5_is_restricted(
  p_user_id uuid, p_kind text default 'all', p_slug text default null
)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.gaming_restrictions r
    where r.user_id = p_user_id
      and r.is_active
      and (r.expires_at is null or r.expires_at > now())
      and (r.game_slug is null or r.game_slug = p_slug)
      and (r.restriction_type = 'all' or r.restriction_type = p_kind)
  );
$$;

create or replace function public.phase5_public_profile_visible(p_user_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.gaming_profiles p
    where p.user_id = p_user_id and p.visibility = 'public' and not p.is_moderated
  );
$$;

create or replace function public.phase5_name_key(p_name text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select btrim(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '', 'g'));
$$;

/* -------------------------------------------------------------------------- */
/* RLS                                                                         */
/* -------------------------------------------------------------------------- */

alter table public.game_catalog enable row level security;
alter table public.game_settings enable row level security;
alter table public.game_achievement_rules enable row level security;
alter table public.gaming_profiles enable row level security;
alter table public.game_ratings enable row level security;
alter table public.game_rating_history enable row level security;
alter table public.game_challenges enable row level security;
alter table public.challenge_history enable row level security;
alter table public.game_matches enable row level security;
alter table public.game_match_players enable row level security;
alter table public.game_match_actions enable row level security;
alter table public.game_match_state_snapshots enable row level security;
alter table public.game_match_results enable row level security;
alter table public.guest_game_sessions enable row level security;
alter table public.guest_match_sessions enable row level security;
alter table public.game_reports enable row level security;
alter table public.match_disputes enable row level security;
alter table public.gaming_restrictions enable row level security;
alter table public.rating_adjustment_history enable row level security;

create policy phase5_catalog_public_read on public.game_catalog for select to anon, authenticated
  using (is_enabled or public.phase5_is_admin());
create policy phase5_catalog_admin_all on public.game_catalog for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_settings_public_read on public.game_settings for select to anon, authenticated
  using (true);
create policy phase5_settings_admin_all on public.game_settings for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_achievement_rules_read on public.game_achievement_rules for select to anon, authenticated
  using (is_enabled or public.phase5_is_admin());
create policy phase5_achievement_rules_admin_all on public.game_achievement_rules for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_profiles_own_read on public.gaming_profiles for select to authenticated
  using (user_id = auth.uid());
create policy phase5_profiles_public_read on public.gaming_profiles for select to anon, authenticated
  using (visibility = 'public' and not is_moderated);
create policy phase5_profiles_admin_all on public.gaming_profiles for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_ratings_own_read on public.game_ratings for select to authenticated
  using (user_id = auth.uid());
create policy phase5_ratings_public_read on public.game_ratings for select to anon, authenticated
  using (
    (select c.leaderboard_visible from public.game_catalog c where c.slug = game_slug)
    and public.phase5_public_profile_visible(user_id)
  );
create policy phase5_ratings_admin_all on public.game_ratings for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_rating_history_own_read on public.game_rating_history for select to authenticated
  using (user_id = auth.uid());
create policy phase5_rating_history_admin_all on public.game_rating_history for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_challenges_participant_read on public.game_challenges for select to authenticated
  using (challenger_id = auth.uid() or opponent_id = auth.uid() or public.phase5_is_admin());
create policy phase5_challenges_admin_all on public.game_challenges for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_challenge_history_read on public.challenge_history for select to authenticated
  using (
    exists (select 1 from public.game_challenges c
      where c.id = challenge_id and (c.challenger_id = auth.uid() or c.opponent_id = auth.uid()))
    or public.phase5_is_admin()
  );
create policy phase5_challenge_history_admin_all on public.challenge_history for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_matches_participant_read on public.game_matches for select to authenticated
  using (public.phase5_is_match_participant(id) or public.phase5_is_admin());
create policy phase5_matches_admin_all on public.game_matches for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_match_players_read on public.game_match_players for select to authenticated
  using (public.phase5_is_match_participant(match_id) or public.phase5_is_admin());
create policy phase5_match_players_admin_all on public.game_match_players for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_actions_participant_read on public.game_match_actions for select to authenticated
  using (public.phase5_is_match_participant(match_id) or public.phase5_is_admin());
create policy phase5_actions_admin_all on public.game_match_actions for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_snapshots_participant_read on public.game_match_state_snapshots for select to authenticated
  using (public.phase5_is_match_participant(match_id) or public.phase5_is_admin());
create policy phase5_snapshots_admin_all on public.game_match_state_snapshots for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_results_participant_read on public.game_match_results for select to authenticated
  using (public.phase5_is_match_participant(match_id) or public.phase5_is_admin());
create policy phase5_results_admin_all on public.game_match_results for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_guest_sessions_insert on public.guest_game_sessions for insert to anon, authenticated
  with check (expires_at > now() and anonymous_id = current_setting('request.jwt.claim.sub', true));
create policy phase5_guest_sessions_admin_all on public.guest_game_sessions for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_guest_matches_insert on public.guest_match_sessions for insert to anon, authenticated
  with check (expires_at > now());
create policy phase5_guest_matches_admin_all on public.guest_match_sessions for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_reports_own_read on public.game_reports for select to authenticated
  using (reporter_id = auth.uid() or public.phase5_is_admin());
create policy phase5_reports_insert on public.game_reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy phase5_reports_admin_all on public.game_reports for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_disputes_participant_read on public.match_disputes for select to authenticated
  using (
    opened_by = auth.uid()
    or exists (select 1 from public.game_match_players p
      where p.match_id = match_id and p.user_id = auth.uid())
    or public.phase5_is_admin()
  );
create policy phase5_disputes_insert on public.match_disputes for insert to authenticated
  with check (
    opened_by = auth.uid()
    and exists (select 1 from public.game_match_players p
      where p.match_id = match_id and p.user_id = auth.uid())
  );
create policy phase5_disputes_admin_all on public.match_disputes for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_restrictions_own_read on public.gaming_restrictions for select to authenticated
  using (user_id = auth.uid() or public.phase5_is_admin());
create policy phase5_restrictions_admin_all on public.gaming_restrictions for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

create policy phase5_adjustments_own_read on public.rating_adjustment_history for select to authenticated
  using (user_id = auth.uid() or public.phase5_is_admin());
create policy phase5_adjustments_admin_all on public.rating_adjustment_history for all to authenticated
  using (public.phase5_is_admin()) with check (public.phase5_is_admin());

/* -------------------------------------------------------------------------- */
/* Grants                                                                      */
/* -------------------------------------------------------------------------- */

grant usage on schema public to anon, authenticated;
grant select on
  public.game_catalog, public.game_settings, public.game_achievement_rules,
  public.gaming_profiles, public.game_ratings
  to anon;
grant select on
  public.game_catalog, public.game_settings, public.game_achievement_rules,
  public.gaming_profiles, public.game_ratings, public.game_rating_history,
  public.game_challenges, public.challenge_history, public.game_matches,
  public.game_match_players, public.game_match_actions,
  public.game_match_state_snapshots, public.game_match_results,
  public.game_reports, public.match_disputes, public.gaming_restrictions,
  public.rating_adjustment_history
  to authenticated;
grant insert on public.game_reports, public.match_disputes to authenticated;
grant insert on public.guest_game_sessions, public.guest_match_sessions to anon;

/* -------------------------------------------------------------------------- */
/* Gaming profile and challenge RPCs                                           */
/* -------------------------------------------------------------------------- */

create or replace function public.phase5_ensure_profile(p_gaming_name text)
returns public.gaming_profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_gaming_name);
  v_key text;
  v_profile public.gaming_profiles;
  v_suffix integer := 2;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if public.phase5_is_restricted(v_user, 'public_profile') then
    raise exception 'Gaming profile access is restricted';
  end if;
  if length(v_name) < 2 or length(v_name) > 40 or v_name ~ '[^[:alnum:] _-]' then
    raise exception 'Use 2-40 letters, numbers, spaces, hyphens or underscores';
  end if;
  v_key := public.phase5_name_key(v_name);
  if length(v_key) < 2 then raise exception 'Gaming name is too short'; end if;

  select * into v_profile from public.gaming_profiles where user_id = v_user;
  if found then return v_profile; end if;

  while exists (select 1 from public.gaming_profiles where gaming_name_key = v_key) loop
    v_key := public.phase5_name_key(v_name) || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.gaming_profiles (user_id, gaming_name, gaming_name_key)
  values (v_user, v_name, v_key)
  returning * into v_profile;
  perform public.phase3_log('phase5_profile_created', 'gaming_profiles', v_user::text,
    jsonb_build_object('gaming_name', v_name));
  return v_profile;
end;
$$;

create or replace function public.phase5_update_profile(
  p_gaming_name text default null,
  p_visibility text default null,
  p_searchable boolean default null,
  p_challenges_enabled boolean default null,
  p_bio text default null
)
returns public.gaming_profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_profile public.gaming_profiles;
  v_name text;
  v_key text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_profile from public.gaming_profiles where user_id = v_user;
  if not found then raise exception 'Create a gaming profile first'; end if;
  if p_visibility is not null and p_visibility not in ('private', 'public') then
    raise exception 'Invalid visibility';
  end if;

  v_name := coalesce(btrim(p_gaming_name), v_profile.gaming_name);
  if length(v_name) < 2 or length(v_name) > 40 or v_name ~ '[^[:alnum:] _-]' then
    raise exception 'Use 2-40 letters, numbers, spaces, hyphens or underscores';
  end if;
  if v_name <> v_profile.gaming_name and v_profile.is_moderated then
    raise exception 'A moderated gaming name cannot be changed until reviewed';
  end if;
  v_key := public.phase5_name_key(v_name);
  if v_key <> v_profile.gaming_name_key and exists (
    select 1 from public.gaming_profiles where gaming_name_key = v_key and user_id <> v_user
  ) then raise exception 'That gaming name is already taken'; end if;

  update public.gaming_profiles set
    gaming_name = v_name,
    gaming_name_key = v_key,
    visibility = coalesce(p_visibility, visibility),
    searchable = coalesce(p_searchable, searchable),
    challenges_enabled = coalesce(p_challenges_enabled, challenges_enabled),
    bio = case when p_bio is null then bio else left(btrim(p_bio), 500) end,
    updated_at = now()
  where user_id = v_user
  returning * into v_profile;

  perform public.phase3_log('phase5_profile_updated', 'gaming_profiles', v_user::text,
    jsonb_build_object('visibility', v_profile.visibility, 'searchable', v_profile.searchable));
  return v_profile;
end;
$$;

create or replace function public.phase5_search_profiles(p_query text)
returns table (user_id uuid, gaming_name text, department_name text)
language sql security definer stable set search_path = public, pg_temp as $$
  with term as (
    select '%' || btrim(regexp_replace(upper(coalesce(p_query, '')), '[^A-Z0-9]+', '', 'g')) || '%' as value
  )
  select p.user_id, p.gaming_name, d.name as department_name
  from public.gaming_profiles p
  join public.profiles pr on pr.id = p.user_id
  left join public.student_directory sd on sd.id = pr.student_directory_id
  left join public.departments d on d.id = sd.department_id
  cross join term
  where p.visibility = 'public'
    and p.searchable
    and p.challenges_enabled
    and not p.is_moderated
    and p.user_id <> auth.uid()
    and not public.phase5_is_restricted(p.user_id, 'challenge')
    and (btrim(regexp_replace(upper(p.gaming_name), '[^A-Z0-9]+', '', 'g')) like term.value
         or btrim(regexp_replace(upper(pr.full_name), '[^A-Z0-9]+', '', 'g')) like term.value)
  order by p.gaming_name
  limit 20;
$$;

create or replace function public.phase5_create_challenge(
  p_game_slug text, p_opponent_id uuid,
  p_settings jsonb default '{}'::jsonb, p_message text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_settings jsonb := coalesce(p_settings, '{}'::jsonb);
  v_expiry integer;
  v_limit integer;
  v_recent integer;
  v_id uuid;
  v_game_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_opponent_id is null or p_opponent_id = v_user then
    raise exception 'Choose another student to challenge';
  end if;
  if not public.phase5_game_enabled(p_game_slug, 'challenge') then
    raise exception 'Challenges are unavailable for this game';
  end if;
  if public.phase5_is_restricted(v_user, 'challenge', p_game_slug)
     or public.phase5_is_restricted(p_opponent_id, 'challenge', p_game_slug) then
    raise exception 'Challenges are restricted for one of these players';
  end if;
  if not exists (select 1 from public.gaming_profiles
    where user_id = p_opponent_id and visibility = 'public' and searchable and challenges_enabled and not is_moderated) then
    raise exception 'That student is not accepting challenges';
  end if;
  if exists (select 1 from public.game_challenges
    where challenger_id = v_user and opponent_id = p_opponent_id
      and game_slug = p_game_slug and status = 'pending') then
    raise exception 'A pending invitation already exists for this game';
  end if;

  select challenge_expiry_minutes, challenge_rate_limit into v_expiry, v_limit
  from public.game_settings where game_slug = p_game_slug;
  select count(*) into v_recent from public.game_challenges
  where challenger_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= coalesce(v_limit, 8) then
    raise exception 'Too many invitations. Try again later';
  end if;

  insert into public.game_challenges (game_slug, challenger_id, opponent_id, settings, message, expires_at)
  values (p_game_slug, v_user, p_opponent_id, v_settings,
    case when p_message is null then null else left(btrim(p_message), 240) end,
    now() + (coalesce(v_expiry, 60) || ' minutes')::interval)
  returning id into v_id;

  insert into public.challenge_history (challenge_id, actor_id, from_status, to_status)
  values (v_id, v_user, null, 'pending');

  select name into v_game_name from public.game_catalog where slug = p_game_slug;
  perform public.phase3_notify_user(p_opponent_id, 'New ' || v_game_name || ' challenge',
    'You have been invited to a ' || v_game_name || ' match. Open your games dashboard to respond.',
    'general', '/games/challenges', 'normal', null);
  perform public.phase3_log('phase5_challenge_created', 'game_challenges', v_id::text,
    jsonb_build_object('game', p_game_slug, 'opponent', p_opponent_id));
  return v_id;
end;
$$;

create or replace function public.phase5_respond_challenge(p_challenge_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_challenge public.game_challenges;
  v_match_id uuid;
  v_public_id text;
  v_new_status text;
  v_name_a text;
  v_name_b text;
  v_config jsonb;
  v_rating integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_challenge from public.game_challenges where id = p_challenge_id for update;
  if not found then raise exception 'Invitation not found'; end if;
  if v_challenge.opponent_id <> v_user then
    raise exception 'Only the invited student can respond';
  end if;
  if v_challenge.status <> 'pending' then raise exception 'This invitation is no longer pending'; end if;
  if v_challenge.expires_at <= now() then
    update public.game_challenges set status = 'expired', updated_at = now() where id = p_challenge_id;
    raise exception 'This invitation has expired';
  end if;

  v_new_status := case when p_accept then 'accepted' else 'rejected' end;
  update public.game_challenges set status = v_new_status, responded_at = now(), updated_at = now()
  where id = p_challenge_id;
  insert into public.challenge_history (challenge_id, actor_id, from_status, to_status)
  values (p_challenge_id, v_user, 'pending', v_new_status);

  if p_accept then
    select coalesce(v_challenge.settings -> 'config', '{}'::jsonb) into v_config;
    select coding_name into v_name_a from (
      select gaming_name as coding_name from public.gaming_profiles where user_id = v_challenge.challenger_id
    ) a;
    select gaming_name into v_name_b from public.gaming_profiles where user_id = v_challenge.opponent_id;
    insert into public.game_matches (public_id, game_slug, mode, status, config, challenge_id, created_by)
    values (encode(gen_random_bytes(12), 'hex'), v_challenge.game_slug, 'ranked', 'waiting',
      coalesce(v_config, '{}'::jsonb), p_challenge_id, v_challenge.challenger_id)
    returning id, public_id into v_match_id, v_public_id;

    insert into public.game_match_players (match_id, player_index, user_id, display_name)
    values (v_match_id, 0, v_challenge.challenger_id, coalesce(v_name_a, 'Player 1')),
           (v_match_id, 1, v_challenge.opponent_id, coalesce(v_name_b, 'Player 2'));

    select starting_rating into v_rating from public.game_settings where game_slug = v_challenge.game_slug;
    insert into public.game_ratings (user_id, game_slug, rating, highest_rating)
    values (v_challenge.challenger_id, v_challenge.game_slug, coalesce(v_rating, 1200), coalesce(v_rating, 1200)),
           (v_challenge.opponent_id, v_challenge.game_slug, coalesce(v_rating, 1200), coalesce(v_rating, 1200))
    on conflict do nothing;

    update public.game_challenges set status = 'match_created', match_id = v_match_id, updated_at = now()
    where id = p_challenge_id;
    insert into public.challenge_history (challenge_id, actor_id, from_status, to_status)
    values (p_challenge_id, v_user, 'accepted', 'match_created');

    perform public.phase3_notify_user(v_challenge.challenger_id, 'Challenge accepted',
      'Your challenge was accepted. Enter the match room when both players are ready.',
      'general', '/games/match/' || v_public_id, 'normal', null);
    perform public.phase3_log('phase5_challenge_accepted', 'game_challenges', p_challenge_id::text,
      jsonb_build_object('matchId', v_match_id));
    return jsonb_build_object('challengeId', p_challenge_id, 'matchId', v_match_id, 'publicId', v_public_id);
  end if;

  perform public.phase3_notify_user(v_challenge.challenger_id, 'Challenge declined',
    'Your invitation was declined.', 'general', '/games/challenges', 'normal', null);
  perform public.phase3_log('phase5_challenge_rejected', 'game_challenges', p_challenge_id::text, '{}'::jsonb);
  return jsonb_build_object('challengeId', p_challenge_id, 'matchId', null, 'publicId', null);
end;
$$;

create or replace function public.phase5_cancel_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_challenge public.game_challenges;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_challenge from public.game_challenges where id = p_challenge_id for update;
  if not found then raise exception 'Invitation not found'; end if;
  if v_challenge.challenger_id <> auth.uid() then raise exception 'Only the sender can cancel'; end if;
  if v_challenge.status <> 'pending' then raise exception 'This invitation is no longer pending'; end if;
  update public.game_challenges set status = 'cancelled', responded_at = now(), updated_at = now()
  where id = p_challenge_id;
  insert into public.challenge_history (challenge_id, actor_id, from_status, to_status)
  values (p_challenge_id, auth.uid(), 'pending', 'cancelled');
  perform public.phase3_log('phase5_challenge_cancelled', 'game_challenges', p_challenge_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.phase5_expire_challenges()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  update public.game_challenges set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

/* -------------------------------------------------------------------------- */
/* Room lifecycle RPCs                                                         */
/* -------------------------------------------------------------------------- */

create or replace function public.phase5_set_ready(p_public_id text, p_ready boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_match public.game_matches;
  v_index integer;
  v_all boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_match from public.game_matches where public_id = p_public_id for update;
  if not found then raise exception 'Match not found'; end if;
  select player_index into v_index from public.game_match_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_index is null then raise exception 'You are not a participant in this match'; end if;
  if v_match.status not in ('waiting', 'countdown') then raise exception 'This match cannot change readiness'; end if;

  update public.game_match_players set ready = p_ready
  where match_id = v_match.id and player_index = v_index;
  select bool_and(ready) into v_all from public.game_match_players where match_id = v_match.id;
  if coalesce(v_all, false) and v_match.status = 'waiting' then
    update public.game_matches set status = 'countdown', updated_at = now() where id = v_match.id;
  elsif not coalesce(v_all, false) and v_match.status = 'countdown' then
    update public.game_matches set status = 'waiting', updated_at = now() where id = v_match.id;
  end if;
  perform public.phase3_log('phase5_ready_changed', 'game_matches', v_match.id::text,
    jsonb_build_object('player', v_index, 'ready', p_ready));
  return jsonb_build_object('ready', p_ready, 'allReady', coalesce(v_all, false));
end;
$$;

create or replace function public.phase5_set_connection(p_public_id text, p_connected boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_match public.game_matches; v_index integer;
begin
  if auth.uid() is null then return; end if;
  select * into v_match from public.game_matches where public_id = p_public_id;
  if not found then return; end if;
  select player_index into v_index from public.game_match_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_index is null then return; end if;
  update public.game_match_players set connected = p_connected
  where match_id = v_match.id and player_index = v_index;
end;
$$;

create or replace function public.phase5_start_match(p_public_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_match public.game_matches;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_match from public.game_matches where public_id = p_public_id for update;
  if not found then raise exception 'Match not found'; end if;
  if not public.phase5_is_match_participant(v_match.id, auth.uid()) then
    raise exception 'You are not a participant in this match';
  end if;
  if v_match.status <> 'countdown' then raise exception 'Both players must be ready first'; end if;
  update public.game_matches set status = 'active', started_at = now(), updated_at = now() where id = v_match.id;
  perform public.phase3_log('phase5_match_started', 'game_matches', v_match.id::text, '{}'::jsonb);
end;
$$;

create or replace function public.phase5_open_dispute(p_public_id text, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_match public.game_matches; v_dispute_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_match from public.game_matches where public_id = p_public_id;
  if not found then raise exception 'Match not found'; end if;
  if not public.phase5_is_match_participant(v_match.id, auth.uid()) then
    raise exception 'You are not a participant in this match';
  end if;
  if length(btrim(p_reason)) < 5 then raise exception 'Give a short reason'; end if;
  insert into public.match_disputes (match_id, opened_by, reason, details)
  values (v_match.id, auth.uid(), left(btrim(p_reason), 200), left(p_details, 2000))
  returning id into v_dispute_id;
  perform public.phase3_log('phase5_dispute_opened', 'match_disputes', v_dispute_id::text,
    jsonb_build_object('matchId', v_match.id));
  return v_dispute_id;
end;
$$;

/* -------------------------------------------------------------------------- */
/* Authoritative action persistence — service_role only                        */
/* -------------------------------------------------------------------------- */

create or replace function public.phase5_submit_action(
  p_public_id text,
  p_user_id uuid,
  p_actor integer,
  p_seq integer,
  p_expected_version integer,
  p_type text,
  p_payload jsonb,
  p_state jsonb,
  p_events jsonb default '[]'::jsonb,
  p_outcome jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_match public.game_matches;
  v_player public.game_match_players;
  v_new_version integer;
  v_result_id uuid;
  v_settings record;
  v_rating_a integer; v_rating_b integer;
  v_expected_a double precision; v_expected_b double precision;
  v_score_a double precision; v_score_b double precision;
  v_delta_a integer; v_delta_b integer;
  v_user_a uuid; v_user_b uuid;
  v_kind text; v_winner integer;
  v_season text;
begin
  select * into v_match from public.game_matches where public_id = p_public_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status <> 'active' then raise exception 'This match is not active'; end if;
  if p_actor not in (0, 1) then raise exception 'Invalid player index'; end if;

  select * into v_player from public.game_match_players
  where match_id = v_match.id and player_index = p_actor for update;
  if not found or v_player.user_id is distinct from p_user_id then
    raise exception 'The acting player does not match the authenticated user';
  end if;
  if v_match.mode = 'ranked' and (
    select count(*) from public.game_match_players where match_id = v_match.id and user_id is null
  ) > 0 then raise exception 'Ranked matches require two authenticated students'; end if;
  if p_seq <> v_match.server_seq + 1 then raise exception 'Action sequence rejected'; end if;
  if p_expected_version <> v_match.version then raise exception 'Stale action version rejected'; end if;
  if p_type !~ '^[a-z_]{2,40}$' then raise exception 'Malformed action type'; end if;
  if coalesce(length(p_payload::text), 0) > 4096 then raise exception 'Action payload too large'; end if;
  if exists (select 1 from public.game_match_actions where match_id = v_match.id and seq = p_seq) then
    raise exception 'Duplicate action';
  end if;
  if not public.phase5_game_enabled(v_match.game_slug,
    case when v_match.mode = 'practice' then 'practice' else 'competitive' end) then
    raise exception 'This game is unavailable';
  end if;

  v_new_version := v_match.version + 1;
  insert into public.game_match_actions
    (match_id, player_index, seq, expected_version, action_type, payload)
  values (v_match.id, p_actor, p_seq, p_expected_version, p_type, coalesce(p_payload, '{}'::jsonb));
  insert into public.game_match_state_snapshots (match_id, version, state)
  values (v_match.id, v_new_version, p_state);

  update public.game_matches set
    state = p_state,
    version = v_new_version,
    server_seq = p_seq,
    status = case when p_outcome is null then status else 'completed' end,
    outcome = coalesce(p_outcome, outcome),
    ended_at = case when p_outcome is null then ended_at else now() end,
    updated_at = now()
  where id = v_match.id;

  if p_outcome is not null then
    v_kind := p_outcome ->> 'kind';
    v_winner := (p_outcome ->> 'winner')::integer;
    insert into public.game_match_results (match_id, game_slug, mode, winner_index, outcome, rating_applied)
    values (v_match.id, v_match.game_slug, v_match.mode, v_winner, p_outcome, false)
    on conflict (match_id) do nothing;

    select * into v_settings from public.game_settings where game_slug = v_match.game_slug;
    select season_key into v_season from public.game_settings where game_slug = v_match.game_slug;

    if v_match.mode = 'ranked'
       and coalesce(v_kind, '') in ('win', 'draw')
       and not exists (select 1 from public.match_disputes where match_id = v_match.id and status in ('open', 'reviewing'))
       and not exists (select 1 from public.game_rating_history where match_id = v_match.id)
       and not public.phase5_is_restricted(v_player.user_id, 'ranked', v_match.game_slug) then
      select user_id, rating into v_user_a, v_rating_a from public.game_match_players
        where match_id = v_match.id and player_index = 0;
      select user_id, rating into v_user_b, v_rating_b from public.game_match_players
        where match_id = v_match.id and player_index = 1;
      select r.rating into v_rating_a from public.game_ratings r
        where r.user_id = v_user_a and r.game_slug = v_match.game_slug and r.season_key = coalesce(v_season, 'all-time');
      select r.rating into v_rating_b from public.game_ratings r
        where r.user_id = v_user_b and r.game_slug = v_match.game_slug and r.season_key = coalesce(v_season, 'all-time');
      v_rating_a := coalesce(v_rating_a, coalesce(v_settings.starting_rating, 1200));
      v_rating_b := coalesce(v_rating_b, coalesce(v_settings.starting_rating, 1200));

      v_expected_a := 1.0 / (1.0 + power(10.0::double precision, (v_rating_b - v_rating_a)::double precision / 400.0));
      v_expected_b := 1.0 - v_expected_a;
      v_score_a := case when v_kind = 'draw' then 0.5 when v_winner = 0 then 1.0 else 0.0 end;
      v_score_b := case when v_kind = 'draw' then 0.5 when v_winner = 1 then 1.0 else 0.0 end;
      v_delta_a := round((coalesce(v_settings.k_factor, 32))::double precision * (v_score_a - v_expected_a))::integer;
      v_delta_b := round((coalesce(v_settings.k_factor, 32))::double precision * (v_score_b - v_expected_b))::integer;

      insert into public.game_rating_history
        (user_id, game_slug, match_id, season_key, before_rating, after_rating, delta, outcome)
      values
        (v_user_a, v_match.game_slug, v_match.id, coalesce(v_season, 'all-time'), v_rating_a, v_rating_a + v_delta_a, v_delta_a,
          case when v_kind = 'draw' then 'draw' when v_winner = 0 then 'win' else 'loss' end),
        (v_user_b, v_match.game_slug, v_match.id, coalesce(v_season, 'all-time'), v_rating_b, v_rating_b + v_delta_b, v_delta_b,
          case when v_kind = 'draw' then 'draw' when v_winner = 1 then 'win' else 'loss' end)
      on conflict do nothing;

      update public.game_ratings set
        rating = rating + v_delta_a,
        highest_rating = greatest(highest_rating, rating + v_delta_a),
        played = played + 1,
        wins = wins + case when v_kind <> 'draw' and v_winner = 0 then 1 else 0 end,
        losses = losses + case when v_kind <> 'draw' and v_winner = 1 then 1 else 0 end,
        draws = draws + case when v_kind = 'draw' then 1 else 0 end,
        last_played_at = now(), updated_at = now()
      where user_id = v_user_a and game_slug = v_match.game_slug and season_key = coalesce(v_season, 'all-time');
      update public.game_ratings set
        rating = rating + v_delta_b,
        highest_rating = greatest(highest_rating, rating + v_delta_b),
        played = played + 1,
        wins = wins + case when v_kind <> 'draw' and v_winner = 1 then 1 else 0 end,
        losses = losses + case when v_kind <> 'draw' and v_winner = 0 then 1 else 0 end,
        draws = draws + case when v_kind = 'draw' then 1 else 0 end,
        last_played_at = now(), updated_at = now()
      where user_id = v_user_b and game_slug = v_match.game_slug and season_key = coalesce(v_season, 'all-time');

      update public.game_match_players set
        rating_before = case when player_index = 0 then v_rating_a else v_rating_b end,
        rating_after = case when player_index = 0 then v_rating_a + v_delta_a else v_rating_b + v_delta_b end,
        rating_delta = case when player_index = 0 then v_delta_a else v_delta_b end
      where match_id = v_match.id;

      update public.game_match_results set rating_applied = true where match_id = v_match.id;
    end if;

    perform public.phase3_notify_user(v_player.user_id, 'Match completed',
      'Your ' || v_match.game_slug || ' match has finished.', 'general',
      '/games/history', 'normal', null);
  end if;

  perform public.phase3_log('phase5_action_submitted', 'game_match_actions', v_match.id::text,
    jsonb_build_object('seq', p_seq, 'type', p_type, 'version', v_new_version));
  return jsonb_build_object('state', p_state, 'version', v_new_version, 'status',
    case when p_outcome is null then 'active' else 'completed' end, 'outcome', p_outcome);
end;
$$;

/* -------------------------------------------------------------------------- */
/* Administration and moderation RPCs                                          */
/* -------------------------------------------------------------------------- */

create or replace function public.phase5_admin_save_game(p_slug text, p_data jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.phase5_is_admin() then raise exception 'PE Admin access required'; end if;
  update public.game_catalog set
    name = coalesce(p_data ->> 'name', name),
    short_name = coalesce(p_data ->> 'shortName', short_name),
    tagline = coalesce(p_data ->> 'tagline', tagline),
    description = coalesce(p_data ->> 'description', description),
    instructions = coalesce(p_data ->> 'instructions', instructions),
    rules = coalesce(p_data -> 'rules', rules),
    category = coalesce(p_data ->> 'category', category),
    accent = coalesce(p_data ->> 'accent', accent),
    sort_order = coalesce((p_data ->> 'sortOrder')::integer, sort_order),
    is_enabled = coalesce((p_data ->> 'isEnabled')::boolean, is_enabled),
    guest_enabled = coalesce((p_data ->> 'guestEnabled')::boolean, guest_enabled),
    competitive_enabled = coalesce((p_data ->> 'competitiveEnabled')::boolean, competitive_enabled),
    challenge_enabled = coalesce((p_data ->> 'challengeEnabled')::boolean, challenge_enabled),
    practice_enabled = coalesce((p_data ->> 'practiceEnabled')::boolean, practice_enabled),
    leaderboard_visible = coalesce((p_data ->> 'leaderboardVisible')::boolean, leaderboard_visible),
    maintenance_message = p_data ->> 'maintenanceMessage',
    updated_at = now()
  where slug = p_slug;
  if not found then raise exception 'Game not found'; end if;
  perform public.phase3_log('phase5_game_updated', 'game_catalog', p_slug, p_data);
end;
$$;

create or replace function public.phase5_admin_save_settings(p_slug text, p_data jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.phase5_is_admin() then raise exception 'PE Admin access required'; end if;
  update public.game_settings set
    starting_rating = coalesce((p_data ->> 'startingRating')::integer, starting_rating),
    k_factor = coalesce((p_data ->> 'kFactor')::integer, k_factor),
    chess_time_controls = coalesce(p_data -> 'chessTimeControls', chess_time_controls),
    default_time_control = coalesce(p_data ->> 'defaultTimeControl', default_time_control),
    default_attempts = coalesce((p_data ->> 'defaultAttempts')::integer, default_attempts),
    penalty_attempts = coalesce((p_data ->> 'penaltyAttempts')::integer, penalty_attempts),
    queen_value = coalesce((p_data ->> 'queenValue')::integer, queen_value),
    coin_value = coalesce((p_data ->> 'coinValue')::integer, coin_value),
    sudden_death = coalesce((p_data ->> 'suddenDeath')::boolean, sudden_death),
    challenge_expiry_minutes = coalesce((p_data ->> 'challengeExpiryMinutes')::integer, challenge_expiry_minutes),
    challenge_rate_limit = coalesce((p_data ->> 'challengeRateLimit')::integer, challenge_rate_limit),
    reconnection_grace_minutes = coalesce((p_data ->> 'reconnectionGraceMinutes')::integer, reconnection_grace_minutes),
    season_key = coalesce(p_data ->> 'seasonKey', season_key),
    season_label = coalesce(p_data ->> 'seasonLabel', season_label),
    updated_by = auth.uid(), updated_at = now()
  where game_slug = p_slug;
  if not found then raise exception 'Settings not found'; end if;
  perform public.phase3_log('phase5_settings_updated', 'game_settings', p_slug, p_data);
end;
$$;

create or replace function public.phase5_admin_adjust_rating(
  p_user_id uuid, p_game_slug text, p_new_rating integer, p_reason text
)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before integer; v_season text;
begin
  if not public.phase5_is_admin() then raise exception 'PE Admin access required'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A detailed reason is required'; end if;
  if p_new_rating < 100 or p_new_rating > 5000 then raise exception 'Invalid rating'; end if;
  select season_key into v_season from public.game_settings where game_slug = p_game_slug;
  select rating into v_before from public.game_ratings
  where user_id = p_user_id and game_slug = p_game_slug and season_key = coalesce(v_season, 'all-time');
  if v_before is null then raise exception 'No rating exists for this player and game'; end if;
  update public.game_ratings set
    rating = p_new_rating,
    highest_rating = greatest(highest_rating, p_new_rating),
    updated_at = now()
  where user_id = p_user_id and game_slug = p_game_slug and season_key = coalesce(v_season, 'all-time');
  insert into public.rating_adjustment_history
    (user_id, game_slug, before_rating, after_rating, delta, reason, adjusted_by)
  values (p_user_id, p_game_slug, v_before, p_new_rating, p_new_rating - v_before,
    left(btrim(p_reason), 500), auth.uid());
  perform public.phase3_log('phase5_rating_adjusted', 'game_ratings', p_user_id || ':' || p_game_slug,
    jsonb_build_object('before', v_before, 'after', p_new_rating, 'reason', p_reason));
  return p_new_rating - v_before;
end;
$$;

create or replace function public.phase5_admin_moderate_name(p_user_id uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.phase5_is_admin() then raise exception 'PE Admin access required'; end if;
  if p_action not in ('flag', 'clear') then raise exception 'Invalid moderation action'; end if;
  update public.gaming_profiles set is_moderated = (p_action = 'flag'), updated_at = now()
  where user_id = p_user_id;
  if not found then raise exception 'Gaming profile not found'; end if;
  perform public.phase3_log('phase5_name_moderated', 'gaming_profiles', p_user_id::text,
    jsonb_build_object('action', p_action, 'note', p_note));
end;
$$;

create or replace function public.phase5_admin_review_report(
  p_report_id uuid, p_status text, p_note text default null
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.phase5_is_admin() then raise exception 'PE Admin access required'; end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then raise exception 'Invalid status'; end if;
  update public.game_reports set status = p_status, reviewed_by = auth.uid(), review_note = p_note, updated_at = now()
  where id = p_report_id;
  if not found then raise exception 'Report not found'; end if;
  perform public.phase3_log('phase5_report_reviewed', 'game_reports', p_report_id::text,
    jsonb_build_object('status', p_status, 'note', p_note));
end;
$$;

create or replace function public.phase5_admin_review_dispute(
  p_dispute_id uuid, p_status text, p_resolution text default null
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_match_id uuid;
begin
  if not public.phase5_is_admin() then raise exception 'PE Admin access required'; end if;
  if p_status not in ('reviewing', 'resolved', 'rejected') then raise exception 'Invalid status'; end if;
  update public.match_disputes set status = p_status, resolution = p_resolution,
    reviewed_by = auth.uid(), updated_at = now()
  where id = p_dispute_id returning match_id into v_match_id;
  if v_match_id is null then raise exception 'Dispute not found'; end if;
  if p_status = 'resolved' and coalesce(p_resolution, '') ilike '%cancel%' then
    update public.game_matches set status = 'cancelled', updated_at = now() where id = v_match_id;
  end if;
  perform public.phase3_log('phase5_dispute_reviewed', 'match_disputes', p_dispute_id::text,
    jsonb_build_object('status', p_status, 'resolution', p_resolution));
end;
$$;

create or replace function public.phase5_admin_set_restriction(
  p_user_id uuid, p_game_slug text, p_type text, p_reason text,
  p_expires_at timestamptz default null, p_active boolean default true
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not public.phase5_is_admin() then raise exception 'PE Admin access required'; end if;
  if p_type not in ('all', 'ranked', 'challenge', 'public_profile') then raise exception 'Invalid restriction'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A reason is required'; end if;
  insert into public.gaming_restrictions (user_id, game_slug, restriction_type, reason, expires_at, created_by, is_active)
  values (p_user_id, nullif(p_game_slug, ''), p_type, left(btrim(p_reason), 500), p_expires_at, auth.uid(), p_active)
  returning id into v_id;
  perform public.phase3_log('phase5_restriction_set', 'gaming_restrictions', v_id::text,
    jsonb_build_object('user', p_user_id, 'type', p_type, 'active', p_active));
  return v_id;
end;
$$;

create or replace function public.phase5_cleanup_guest_sessions()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  delete from public.guest_game_sessions where expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

/* -------------------------------------------------------------------------- */
/* Function grants                                                             */
/* -------------------------------------------------------------------------- */

revoke all on function public.phase5_is_admin() from public;
revoke all on function public.phase5_is_match_participant(uuid, uuid) from public;
revoke all on function public.phase5_game_enabled(text, text) from public;
revoke all on function public.phase5_is_restricted(uuid, text, text) from public;
revoke all on function public.phase5_public_profile_visible(uuid) from public;
revoke all on function public.phase5_name_key(text) from public;
revoke all on function public.phase5_submit_action(text, uuid, integer, integer, integer, text, jsonb, jsonb, jsonb, jsonb) from public;

grant execute on function public.phase5_is_admin() to authenticated;
grant execute on function public.phase5_is_match_participant(uuid, uuid) to authenticated;
grant execute on function public.phase5_game_enabled(text, text) to anon, authenticated;
grant execute on function public.phase5_public_profile_visible(uuid) to anon, authenticated;
grant execute on function public.phase5_name_key(text) to authenticated;
grant execute on function public.phase5_ensure_profile(text) to authenticated;
grant execute on function public.phase5_update_profile(text, text, boolean, boolean, text) to authenticated;
grant execute on function public.phase5_search_profiles(text) to authenticated;
grant execute on function public.phase5_create_challenge(text, uuid, jsonb, text) to authenticated;
grant execute on function public.phase5_respond_challenge(uuid, boolean) to authenticated;
grant execute on function public.phase5_cancel_challenge(uuid) to authenticated;
grant execute on function public.phase5_expire_challenges() to authenticated;
grant execute on function public.phase5_set_ready(text, boolean) to authenticated;
grant execute on function public.phase5_set_connection(text, boolean) to authenticated;
grant execute on function public.phase5_start_match(text) to authenticated;
grant execute on function public.phase5_open_dispute(text, text, text) to authenticated;
grant execute on function public.phase5_admin_save_game(text, jsonb) to authenticated;
grant execute on function public.phase5_admin_save_settings(text, jsonb) to authenticated;
grant execute on function public.phase5_admin_adjust_rating(uuid, text, integer, text) to authenticated;
grant execute on function public.phase5_admin_moderate_name(uuid, text, text) to authenticated;
grant execute on function public.phase5_admin_review_report(uuid, text, text) to authenticated;
grant execute on function public.phase5_admin_review_dispute(uuid, text, text) to authenticated;
grant execute on function public.phase5_admin_set_restriction(uuid, text, text, text, timestamptz, boolean) to authenticated;
grant execute on function public.phase5_cleanup_guest_sessions() to authenticated;

-- Action persistence is deliberately NOT granted to anon or authenticated.
revoke all on function public.phase5_submit_action(text, uuid, integer, integer, integer, text, jsonb, jsonb, jsonb, jsonb) from anon, authenticated;
grant execute on function public.phase5_submit_action(text, uuid, integer, integer, integer, text, jsonb, jsonb, jsonb, jsonb) to service_role;

/* -------------------------------------------------------------------------- */
/* Realtime + documentation                                                    */
/* -------------------------------------------------------------------------- */

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.game_matches;
    alter publication supabase_realtime add table public.game_match_players;
    alter publication supabase_realtime add table public.game_match_actions;
    alter publication supabase_realtime add table public.game_challenges;
    alter publication supabase_realtime add table public.game_ratings;
  end if;
end $$;

comment on table public.game_matches is 'Phase 5 authoritative match record. State is versioned; only service_role may persist actions after the TypeScript engine validates them.';
comment on table public.game_ratings is 'Independent Elo rating per game and season. Guests and practice matches never appear here.';
comment on table public.guest_game_sessions is 'Anonymous, short-lived guest play sessions. Never linked to student profiles or ratings.';
comment on function public.phase5_submit_action is 'Service-role-only transactional action persistence. Rejects duplicate, stale, out-of-turn and unauthorised actions.';
