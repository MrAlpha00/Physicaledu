-- Phase 4 — sports events, registrations, payments, tournaments and organisers
-- Additive migration. Apply after 0001, 0002 and 0003. No existing table data is
-- modified; new tables carry their own RLS policies and audit history.

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------------- */
/* Files — R2 metadata (private bucket; signed URLs only)                     */
/* ------------------------------------------------------------------------- */

create table public.phase4_files (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  bucket text not null default 'r2',
  original_filename text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  uploader_id uuid references auth.users (id) on delete set null,
  parent_type text not null check (parent_type in (
    'event_banner', 'event_logo', 'sport_image', 'payment_qr',
    'payment_proof', 'team_document', 'participant_document')),
  parent_id uuid not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  upload_status text not null default 'pending' check (upload_status in ('pending', 'confirmed', 'failed')),
  sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index phase4_files_parent_idx on public.phase4_files (parent_type, parent_id);
create index phase4_files_uploader_idx on public.phase4_files (uploader_id);

create trigger phase4_files_set_updated_at
  before update on public.phase4_files
  for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------------- */
/* Events and competitions                                                    */
/* ------------------------------------------------------------------------- */

create table public.sports_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  banner_file_id uuid references public.phase4_files (id) on delete set null,
  logo_file_id uuid references public.phase4_files (id) on delete set null,
  academic_year text not null,
  starts_on date,
  ends_on date,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  venue text,
  instructions text,
  contact_information text,
  is_public boolean not null default false,
  status text not null default 'draft' check (status in (
    'draft', 'published', 'registration_open', 'registration_closed',
    'ongoing', 'completed', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sports_events_date_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.event_sports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sports_events (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  image_file_id uuid references public.phase4_files (id) on delete set null,
  category text,
  mode text not null check (mode in ('team', 'individual')),
  venue text,
  registration_start timestamptz,
  registration_deadline timestamptz,
  competition_date timestamptz,
  max_entries integer check (max_entries is null or max_entries > 0),
  is_public boolean not null default true,
  status text not null default 'draft' check (status in (
    'draft', 'published', 'registration_open', 'registration_closed',
    'ongoing', 'completed', 'archived')),
  scoring_mode text not null default 'simple'
    check (scoring_mode in ('simple', 'sets', 'time', 'manual')),
  tournament_format text not null default 'knockout'
    check (tournament_format in ('knockout', 'round_robin', 'group_knockout')),
  draw_mode text not null default 'random' check (draw_mode in ('random', 'seeded', 'manual')),
  third_place boolean not null default false,
  group_count integer check (group_count is null or (group_count >= 2 and group_count <= 32)),
  qualifiers_per_group integer check (qualifiers_per_group is null or qualifiers_per_group > 0),
  legs integer not null default 1 check (legs between 1 and 2),
  points jsonb not null default '{"win":3,"draw":1,"loss":0,"tiebreakers":["competition_points","point_difference","points_scored","wins"]}'::jsonb,
  auto_advance boolean not null default true,
  organizer_results_require_approval boolean not null default false,
  draw_locked boolean not null default false,
  started_at timestamptz,
  registration_rule_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_sports_slug_unique unique (event_id, slug),
  constraint event_sports_deadline_order check (
    registration_start is null or registration_deadline is null or registration_deadline >= registration_start)
);

create table public.competition_rules (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null unique references public.event_sports (id) on delete cascade,
  team_name_required boolean not null default true,
  min_team_size integer check (min_team_size is null or min_team_size > 0),
  max_team_size integer check (max_team_size is null or max_team_size > 0),
  team_limit integer check (team_limit is null or team_limit > 0),
  captain_required boolean not null default true,
  substitute_allowance integer not null default 0 check (substitute_allowance >= 0),
  allow_multiple_competitions boolean not null default true,
  allow_duplicate_player_other_team boolean not null default false,
  require_member_confirmation boolean not null default false,
  require_manual_identity_verification boolean not null default false,
  required_participant_fields text[] not null default '{}',
  custom_questions jsonb not null default '[]'::jsonb,
  public_rules text,
  eligibility_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_rules_team_size check (
    min_team_size is null or max_team_size is null or max_team_size >= min_team_size)
);

create table public.competition_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.event_sports (id) on delete cascade,
  rule_type text not null check (rule_type in (
    'department', 'semester', 'academic_year', 'min_weight', 'max_weight', 'custom')),
  rule_value jsonb not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index competition_eligibility_competition_idx
  on public.competition_eligibility_rules (competition_id);

create table public.competition_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.event_sports (id) on delete cascade,
  kind text not null check (kind in ('team', 'individual')),
  team_name text,
  captain_user_id uuid references auth.users (id) on delete set null,
  captain_directory_id uuid references public.student_directory (id) on delete restrict,
  contact_email text,
  contact_phone text,
  status text not null default 'submitted' check (status in (
    'draft', 'submitted', 'under_review', 'approved', 'rejected', 'waitlisted', 'withdrawn')),
  payment_status text not null default 'not_required' check (payment_status in (
    'not_required', 'pending_verification', 'verified', 'rejected', 'waived', 'refunded')),
  seed integer check (seed is null or seed > 0),
  rules_snapshot jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  rejection_reason text,
  correction_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index competition_entries_team_name_uidx
  on public.competition_entries (competition_id, lower(btrim(team_name)))
  where team_name is not null and status <> 'withdrawn';
create index competition_entries_competition_idx
  on public.competition_entries (competition_id, status);
create index competition_entries_captain_idx on public.competition_entries (captain_user_id);

create table public.competition_entry_members (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.competition_entries (id) on delete cascade,
  student_directory_id uuid not null references public.student_directory (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  usn text not null,
  department_id uuid references public.departments (id) on delete set null,
  semester smallint check (semester is null or (semester >= 1 and semester <= 12)),
  academic_year smallint check (academic_year is null or (academic_year >= 1 and academic_year <= 6)),
  weight_kg numeric(6,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  is_captain boolean not null default false,
  is_substitute boolean not null default false,
  confirmation_status text not null default 'pending' check (confirmation_status in (
    'pending', 'accepted', 'declined', 'verified')),
  confirmed_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_entry_members_unique unique (entry_id, student_directory_id)
);

create index competition_entry_members_directory_idx
  on public.competition_entry_members (student_directory_id);

create table public.registration_history (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.competition_entries (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.participant_invitations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.competition_entries (id) on delete cascade,
  member_id uuid not null references public.competition_entry_members (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------------------------- */
/* Payments — proof stays private, verification is independent of eligibility */
/* ------------------------------------------------------------------------- */

create table public.competition_payment_settings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null unique references public.event_sports (id) on delete cascade,
  is_required boolean not null default false,
  fee_amount numeric(10,2) check (fee_amount is null or fee_amount >= 0),
  payment_unit text not null default 'team' check (payment_unit in ('team', 'participant')),
  instructions text,
  qr_file_id uuid references public.phase4_files (id) on delete set null,
  payment_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competition_payment_records (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.competition_entries (id) on delete cascade,
  proof_file_id uuid references public.phase4_files (id) on delete set null,
  transaction_reference text,
  claimed_amount numeric(10,2) check (claimed_amount is null or claimed_amount >= 0),
  status text not null default 'pending_verification' check (status in (
    'not_required', 'pending_verification', 'verified', 'rejected', 'waived', 'refunded')),
  note text,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_verification_history (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.competition_payment_records (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create trigger sports_events_set_updated_at
  before update on public.sports_events for each row execute function public.set_updated_at();
create trigger event_sports_set_updated_at
  before update on public.event_sports for each row execute function public.set_updated_at();
create trigger competition_rules_set_updated_at
  before update on public.competition_rules for each row execute function public.set_updated_at();
create trigger competition_eligibility_set_updated_at
  before update on public.competition_eligibility_rules for each row execute function public.set_updated_at();
create trigger competition_entries_set_updated_at
  before update on public.competition_entries for each row execute function public.set_updated_at();
create trigger competition_entry_members_set_updated_at
  before update on public.competition_entry_members for each row execute function public.set_updated_at();
create trigger competition_payment_settings_set_updated_at
  before update on public.competition_payment_settings for each row execute function public.set_updated_at();
create trigger competition_payment_records_set_updated_at
  before update on public.competition_payment_records for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------------- */
/* Tournament structure — relational source of truth for the canvas           */
/* ------------------------------------------------------------------------- */

create table public.tournament_draws (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.event_sports (id) on delete cascade,
  format text not null check (format in ('knockout', 'round_robin', 'group_knockout')),
  draw_mode text not null check (draw_mode in ('random', 'seeded', 'manual')),
  draw_seed bigint not null default 0,
  version integer not null default 1,
  status text not null default 'active' check (status in ('draft', 'active', 'locked', 'archived')),
  payload jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users (id) on delete set null,
  generated_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid references auth.users (id) on delete set null,
  lock_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tournament_draws_competition_idx on public.tournament_draws (competition_id, status);
create unique index tournament_draws_one_active_uidx
  on public.tournament_draws (competition_id) where status in ('active', 'locked');

create table public.tournament_stages (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.tournament_draws (id) on delete cascade,
  stage_key text not null,
  name text not null,
  stage_type text not null check (stage_type in ('group', 'league', 'knockout', 'third_place')),
  sequence integer not null default 1,
  created_at timestamptz not null default now(),
  constraint tournament_stages_unique unique (draw_id, stage_key)
);

create table public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.tournament_stages (id) on delete cascade,
  group_key text not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_groups_unique unique (stage_id, group_key)
);

create table public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.tournament_draws (id) on delete cascade,
  entry_id uuid references public.competition_entries (id) on delete restrict,
  group_id uuid references public.tournament_groups (id) on delete set null,
  placeholder_key text,
  seed integer,
  status text not null default 'active'
    check (status in ('active', 'qualified', 'eliminated', 'withdrawn')),
  created_at timestamptz not null default now(),
  constraint tournament_participants_entry_unique unique (draw_id, entry_id),
  constraint tournament_participants_placeholder_unique unique (draw_id, placeholder_key),
  constraint tournament_participants_identity check (
    entry_id is not null or placeholder_key is not null)
);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.tournament_draws (id) on delete cascade,
  stage_id uuid references public.tournament_stages (id) on delete set null,
  group_id uuid references public.tournament_groups (id) on delete set null,
  round_key text not null,
  round_name text not null,
  round_number integer not null,
  match_number integer not null,
  status text not null default 'scheduled' check (status in (
    'scheduled', 'ready', 'ongoing', 'result_submitted', 'completed',
    'postponed', 'cancelled', 'disputed')),
  starts_at timestamptz,
  ends_at timestamptz,
  venue text,
  organizer_id uuid references auth.users (id) on delete set null,
  winner_entry_id uuid references public.competition_entries (id) on delete set null,
  is_bye boolean not null default false,
  notes text,
  calendar_event_id uuid references public.pe_calendar_events (id) on delete set null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_matches_number_unique unique (draw_id, match_number)
);

create index tournament_matches_draw_idx on public.tournament_matches (draw_id, round_number);
create index tournament_matches_organizer_idx on public.tournament_matches (organizer_id, status);

create table public.tournament_match_slots (
  match_id uuid not null references public.tournament_matches (id) on delete cascade,
  slot text not null check (slot in ('a', 'b')),
  entry_id uuid references public.competition_entries (id) on delete restrict,
  participant_id uuid references public.tournament_participants (id) on delete set null,
  source_match_id uuid references public.tournament_matches (id) on delete set null,
  from_bye boolean not null default false,
  primary key (match_id, slot)
);

create table public.tournament_match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.tournament_matches (id) on delete cascade,
  score_a numeric(10,2),
  score_b numeric(10,2),
  breakdown jsonb not null default '[]'::jsonb,
  winner_entry_id uuid references public.competition_entries (id) on delete restrict,
  result_note text,
  submitted_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default now(),
  is_authoritative boolean not null default true,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_match_result_history (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.tournament_matches (id) on delete cascade,
  result_id uuid,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tournament_standings (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.tournament_draws (id) on delete cascade,
  group_id uuid references public.tournament_groups (id) on delete cascade,
  group_key text not null default 'overall',
  entry_id uuid not null references public.competition_entries (id) on delete cascade,
  position integer not null default 0,
  played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  points_for numeric(10,2) not null default 0,
  points_against numeric(10,2) not null default 0,
  point_difference numeric(10,2) not null default 0,
  competition_points numeric(10,2) not null default 0,
  qualified boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint tournament_standings_unique unique (draw_id, group_key, entry_id)
);

create table public.tournament_graph_edges (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.tournament_draws (id) on delete cascade,
  source_match_id uuid not null references public.tournament_matches (id) on delete cascade,
  target_match_id uuid not null references public.tournament_matches (id) on delete cascade,
  target_slot text not null check (target_slot in ('a', 'b')),
  feed text not null default 'winner' check (feed in ('winner', 'loser')),
  created_at timestamptz not null default now(),
  constraint tournament_graph_edges_unique unique (source_match_id, target_match_id, target_slot, feed),
  constraint tournament_graph_edges_no_self check (source_match_id <> target_match_id)
);

create table public.tournament_node_positions (
  draw_id uuid not null references public.tournament_draws (id) on delete cascade,
  node_key text not null,
  position jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (draw_id, node_key)
);

create trigger tournament_draws_set_updated_at
  before update on public.tournament_draws for each row execute function public.set_updated_at();
create trigger tournament_matches_set_updated_at
  before update on public.tournament_matches for each row execute function public.set_updated_at();
create trigger tournament_match_results_set_updated_at
  before update on public.tournament_match_results for each row execute function public.set_updated_at();
create trigger tournament_standings_set_updated_at
  before update on public.tournament_standings for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------------- */
/* Organisers and calendar links                                              */
/* ------------------------------------------------------------------------- */

create table public.sport_organizer_assignments (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.event_sports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_directory_id uuid references public.student_directory (id) on delete set null,
  assigned_by uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  can_submit_results boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint sport_organizer_assignments_unique unique (competition_id, user_id)
);

create index sport_organizer_assignments_user_idx
  on public.sport_organizer_assignments (user_id, status);

create table public.organizer_invitations (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.event_sports (id) on delete cascade,
  student_directory_id uuid not null references public.student_directory (id) on delete cascade,
  token_hash text not null unique,
  assigned_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint organizer_invitations_expiry check (expires_at > created_at)
);

create index organizer_invitations_competition_idx
  on public.organizer_invitations (competition_id, expires_at);

create table public.organizer_activity_logs (
  id bigint generated always as identity primary key,
  competition_id uuid not null references public.event_sports (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  match_id uuid references public.tournament_matches (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.phase4_calendar_links (
  source_type text not null check (source_type in ('event', 'match')),
  source_id uuid not null,
  calendar_event_id uuid not null references public.pe_calendar_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_type, source_id)
);

/* ------------------------------------------------------------------------- */
/* Scoped access helpers — organisers never receive a global admin role        */
/* ------------------------------------------------------------------------- */

create or replace function public.phase4_is_admin()
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select public.is_pe_admin();
$$;

create or replace function public.phase4_has_sport_access(
  p_competition_id uuid, p_user_id uuid default auth.uid()
) returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.sport_organizer_assignments a
    where a.competition_id = p_competition_id
      and a.user_id = p_user_id
      and a.status = 'active'
  );
$$;

create or replace function public.phase4_event_is_public(p_event_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.sports_events e
    where e.id = p_event_id and e.is_public
      and e.status in ('published', 'registration_open', 'registration_closed', 'ongoing', 'completed')
  );
$$;

create or replace function public.phase4_competition_is_public(p_competition_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.event_sports s
    join public.sports_events e on e.id = s.event_id
    where s.id = p_competition_id and s.is_public and s.status <> 'draft'
      and public.phase4_event_is_public(e.id)
  );
$$;

create or replace function public.phase4_owns_entry(p_entry_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.competition_entries en
    where en.id = p_entry_id and en.captain_user_id = p_user_id
  ) or exists (
    select 1 from public.competition_entry_members m
    where m.entry_id = p_entry_id and m.user_id = p_user_id
  );
$$;

create or replace function public.phase4_can_view_competition(p_competition_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select public.phase4_competition_is_public(p_competition_id)
    or public.phase4_has_sport_access(p_competition_id)
    or public.phase4_is_admin();
$$;

create or replace function public.phase4_can_view_file(p_file_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.phase4_files f
    where f.id = p_file_id
      and (
        public.phase4_is_admin()
        or f.uploader_id = auth.uid()
        or (
          f.visibility = 'public'
          and f.parent_type in ('event_banner', 'event_logo', 'sport_image', 'payment_qr')
          and f.upload_status = 'confirmed'
          and (
            (f.parent_type in ('event_banner', 'event_logo')
              and public.phase4_event_is_public(f.parent_id))
            or (f.parent_type in ('sport_image', 'payment_qr')
              and public.phase4_competition_is_public(f.parent_id))
          )
        )
      )
  );
$$;

create or replace function public.phase4_notify_users(
  p_user_ids uuid[], p_title text, p_body text,
  p_category text default 'general', p_link text default null
) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
  v_count integer := 0;
begin
  if p_user_ids is null then return 0; end if;
  foreach v_user in array p_user_ids loop
    if v_user is not null then
      perform public.phase3_notify_user(v_user, p_title, p_body, p_category, p_link, 'normal', null);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

/* ------------------------------------------------------------------------- */
/* Row level security                                                         */
/* ------------------------------------------------------------------------- */

alter table public.phase4_files enable row level security;
alter table public.sports_events enable row level security;
alter table public.event_sports enable row level security;
alter table public.competition_rules enable row level security;
alter table public.competition_eligibility_rules enable row level security;
alter table public.competition_entries enable row level security;
alter table public.competition_entry_members enable row level security;
alter table public.registration_history enable row level security;
alter table public.participant_invitations enable row level security;
alter table public.competition_payment_settings enable row level security;
alter table public.competition_payment_records enable row level security;
alter table public.payment_verification_history enable row level security;
alter table public.tournament_draws enable row level security;
alter table public.tournament_stages enable row level security;
alter table public.tournament_groups enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_match_slots enable row level security;
alter table public.tournament_match_results enable row level security;
alter table public.tournament_match_result_history enable row level security;
alter table public.tournament_standings enable row level security;
alter table public.tournament_graph_edges enable row level security;
alter table public.tournament_node_positions enable row level security;
alter table public.sport_organizer_assignments enable row level security;
alter table public.organizer_invitations enable row level security;
alter table public.organizer_activity_logs enable row level security;
alter table public.phase4_calendar_links enable row level security;

create policy phase4_files_admin_all on public.phase4_files for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_files_owner_read on public.phase4_files for select to authenticated
  using (uploader_id = auth.uid());
create policy phase4_files_public_read on public.phase4_files for select to anon, authenticated
  using (public.phase4_can_view_file(id));

create policy phase4_events_admin_all on public.sports_events for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_events_public_read on public.sports_events for select to anon, authenticated
  using (public.phase4_event_is_public(id));
create policy phase4_events_organizer_read on public.sports_events for select to authenticated
  using (exists (
    select 1 from public.event_sports s
    where s.event_id = public.sports_events.id and public.phase4_has_sport_access(s.id)));

create policy phase4_sports_admin_all on public.event_sports for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_sports_public_read on public.event_sports for select to anon, authenticated
  using (public.phase4_competition_is_public(id));
create policy phase4_sports_organizer_read on public.event_sports for select to authenticated
  using (public.phase4_has_sport_access(id));

create policy phase4_rules_admin_all on public.competition_rules for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_rules_read on public.competition_rules for select to anon, authenticated
  using (public.phase4_can_view_competition(competition_id));
create policy phase4_eligibility_admin_all on public.competition_eligibility_rules for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_eligibility_organizer_read on public.competition_eligibility_rules for select to authenticated
  using (public.phase4_has_sport_access(competition_id));
create policy phase4_eligibility_public_read on public.competition_eligibility_rules for select to anon, authenticated
  using (public.phase4_competition_is_public(competition_id));

create policy phase4_entries_admin_all on public.competition_entries for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_entries_owner_read on public.competition_entries for select to authenticated
  using (public.phase4_owns_entry(id));
create policy phase4_entries_organizer_read on public.competition_entries for select to authenticated
  using (public.phase4_has_sport_access(competition_id));

create policy phase4_members_admin_all on public.competition_entry_members for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_members_owner_read on public.competition_entry_members for select to authenticated
  using (public.phase4_owns_entry(entry_id));
create policy phase4_members_organizer_read on public.competition_entry_members for select to authenticated
  using (exists (
    select 1 from public.competition_entries en
    where en.id = entry_id and public.phase4_has_sport_access(en.competition_id)));

create policy phase4_registration_history_admin_all on public.registration_history for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_registration_history_owner_read on public.registration_history for select to authenticated
  using (public.phase4_owns_entry(entry_id));

create policy phase4_participant_invites_admin_all on public.participant_invitations for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_participant_invites_owner_read on public.participant_invitations for select to authenticated
  using (exists (
    select 1 from public.competition_entry_members m
    where m.id = member_id and m.user_id = auth.uid()));

create policy phase4_payment_settings_admin_all on public.competition_payment_settings for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_payment_settings_public_read on public.competition_payment_settings for select to anon, authenticated
  using (is_required and public.phase4_competition_is_public(competition_id));

create policy phase4_payment_records_admin_all on public.competition_payment_records for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_payment_records_owner_read on public.competition_payment_records for select to authenticated
  using (public.phase4_owns_entry(entry_id));
create policy phase4_payment_history_admin_all on public.payment_verification_history for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_payment_history_owner_read on public.payment_verification_history for select to authenticated
  using (exists (
    select 1 from public.competition_payment_records p
    where p.id = payment_id and public.phase4_owns_entry(p.entry_id)));

-- Tournament tables: public read of validated structures, organiser read of
-- assigned competitions, writes exclusively through admin RPCs.
create policy phase4_draws_admin_all on public.tournament_draws for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_draws_read on public.tournament_draws for select to anon, authenticated
  using (exists (
    select 1 from public.event_sports s
    where s.id = competition_id and public.phase4_competition_is_public(s.id)));

create policy phase4_stages_admin_all on public.tournament_stages for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_stages_read on public.tournament_stages for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_draws d
    where d.id = draw_id and public.phase4_competition_is_public(d.competition_id)));

create policy phase4_groups_admin_all on public.tournament_groups for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_groups_read on public.tournament_groups for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_stages st
    join public.tournament_draws d on d.id = st.draw_id
    where st.id = stage_id and public.phase4_competition_is_public(d.competition_id)));

create policy phase4_participants_admin_all on public.tournament_participants for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_participants_read on public.tournament_participants for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_draws d
    where d.id = draw_id and public.phase4_competition_is_public(d.competition_id)));

create policy phase4_matches_admin_all on public.tournament_matches for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_matches_organizer_read on public.tournament_matches for select to authenticated
  using (exists (
    select 1 from public.tournament_draws d
    where d.id = draw_id and public.phase4_has_sport_access(d.competition_id)));
create policy phase4_matches_public_read on public.tournament_matches for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_draws d
    where d.id = draw_id and public.phase4_competition_is_public(d.competition_id)));

create policy phase4_slots_admin_all on public.tournament_match_slots for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_slots_read on public.tournament_match_slots for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_matches m
    join public.tournament_draws d on d.id = m.draw_id
    where m.id = match_id and public.phase4_competition_is_public(d.competition_id)));

create policy phase4_results_admin_all on public.tournament_match_results for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_results_organizer_read on public.tournament_match_results for select to authenticated
  using (exists (
    select 1 from public.tournament_matches m
    join public.tournament_draws d on d.id = m.draw_id
    where m.id = match_id and public.phase4_has_sport_access(d.competition_id)));
create policy phase4_results_public_read on public.tournament_match_results for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_matches m
    join public.tournament_draws d on d.id = m.draw_id
    join public.event_sports s on s.id = d.competition_id
    where m.id = match_id and m.status = 'completed'
      and public.phase4_competition_is_public(s.id)));

create policy phase4_result_history_admin_all on public.tournament_match_result_history for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_result_history_read on public.tournament_match_result_history for select to authenticated
  using (exists (
    select 1 from public.tournament_matches m
    join public.tournament_draws d on d.id = m.draw_id
    where m.id = match_id and public.phase4_has_sport_access(d.competition_id)));

create policy phase4_standings_admin_all on public.tournament_standings for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_standings_read on public.tournament_standings for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_draws d
    where d.id = draw_id and public.phase4_competition_is_public(d.competition_id)));

create policy phase4_edges_admin_all on public.tournament_graph_edges for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_edges_read on public.tournament_graph_edges for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_draws d
    where d.id = draw_id and public.phase4_competition_is_public(d.competition_id)));
create policy phase4_positions_admin_all on public.tournament_node_positions for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_positions_read on public.tournament_node_positions for select to anon, authenticated
  using (exists (
    select 1 from public.tournament_draws d
    where d.id = draw_id and public.phase4_competition_is_public(d.competition_id)));

create policy phase4_assignments_admin_all on public.sport_organizer_assignments for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_assignments_own_read on public.sport_organizer_assignments for select to authenticated
  using (user_id = auth.uid());

create policy phase4_invitations_admin_all on public.organizer_invitations for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_invitations_own_read on public.organizer_invitations for select to authenticated
  using (student_directory_id = public.current_phase3_student_directory_id());

create policy phase4_activity_admin_all on public.organizer_activity_logs for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_activity_own_read on public.organizer_activity_logs for select to authenticated
  using (user_id = auth.uid() or public.phase4_has_sport_access(competition_id));

create policy phase4_calendar_links_admin_all on public.phase4_calendar_links for all to authenticated
  using (public.phase4_is_admin()) with check (public.phase4_is_admin());
create policy phase4_calendar_links_read on public.phase4_calendar_links for select to authenticated
  using (public.phase4_is_admin() or source_type = 'match');

/* ------------------------------------------------------------------------- */
/* Grants — RLS remains the final authority                                   */
/* ------------------------------------------------------------------------- */

grant select on
  public.phase4_files, public.sports_events, public.event_sports,
  public.competition_rules, public.competition_eligibility_rules,
  public.competition_payment_settings, public.tournament_draws,
  public.tournament_stages, public.tournament_groups,
  public.tournament_participants, public.tournament_matches,
  public.tournament_match_slots, public.tournament_match_results,
  public.tournament_standings, public.tournament_graph_edges,
  public.tournament_node_positions
  to anon;
grant select, insert, update, delete on
  public.phase4_files, public.sports_events, public.event_sports,
  public.competition_rules, public.competition_eligibility_rules,
  public.competition_entries, public.competition_entry_members,
  public.registration_history, public.participant_invitations,
  public.competition_payment_settings, public.competition_payment_records,
  public.payment_verification_history, public.tournament_draws,
  public.tournament_stages, public.tournament_groups,
  public.tournament_participants, public.tournament_matches,
  public.tournament_match_slots, public.tournament_match_results,
  public.tournament_match_result_history, public.tournament_standings,
  public.tournament_graph_edges, public.tournament_node_positions,
  public.sport_organizer_assignments, public.organizer_invitations,
  public.organizer_activity_logs, public.phase4_calendar_links
  to authenticated;

/* ------------------------------------------------------------------------- */
/* Transactional operations                                                   */
/* ------------------------------------------------------------------------- */

create or replace function public.phase4_validate_plan(p_plan jsonb)
returns text[] language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_errors text[] := '{}';
  v_count integer;
  v_unique integer;
  v_cycles integer;
begin
  if p_plan is null or p_plan->'matches' is null then
    return array['Tournament plan has no matches.'];
  end if;

  select count(*) into v_count from jsonb_array_elements(p_plan->'matches');
  select count(distinct value->>'key') into v_unique from jsonb_array_elements(p_plan->'matches');
  if v_count <> v_unique then
    v_errors := array_append(v_errors, 'Duplicate match identifiers in draw.');
  end if;

  select count(*) into v_count from jsonb_array_elements(p_plan->'matches') m
  where m.value->>'slotA' is null or m.value->>'slotB' is null;
  if v_count > 0 then
    v_errors := array_append(v_errors, 'A match is missing a slot.');
  end if;

  select count(*) into v_count
  from jsonb_array_elements(coalesce(p_plan->'edges', '[]'::jsonb)) e
  where not exists (
    select 1 from jsonb_array_elements(p_plan->'matches') m
    where m.value->>'key' = e.value->>'sourceMatchKey')
    or not exists (
    select 1 from jsonb_array_elements(p_plan->'matches') m
    where m.value->>'key' = e.value->>'targetMatchKey');
  if v_count > 0 then
    v_errors := array_append(v_errors, 'Progression edge references an unknown match.');
  end if;

  select count(*) into v_count
  from jsonb_array_elements(coalesce(p_plan->'edges', '[]'::jsonb)) e
  group by e.value->>'targetMatchKey', e.value->>'targetSlot'
  having count(*) > 1;
  get diagnostics v_unique = row_count;
  if v_unique > 0 then
    v_errors := array_append(v_errors, 'A match slot has multiple incoming feeds.');
  end if;

  with recursive graph as (
    select e.value->>'sourceMatchKey' as src, e.value->>'targetMatchKey' as dst
    from jsonb_array_elements(coalesce(p_plan->'edges', '[]'::jsonb)) e
  ), walk(start_key, current_key, depth) as (
    select src, dst, 1 from graph where src <> dst
    union all
    select w.start_key, g.dst, w.depth + 1
    from walk w join graph g on g.src = w.current_key
    where w.depth < 64
  )
  select count(*) into v_cycles from walk where start_key = current_key;
  if v_cycles > 0 then
    v_errors := array_append(v_errors, 'Tournament progression contains a cycle.');
  end if;

  return v_errors;
end;
$$;

create or replace function public.phase4_save_draw(
  p_competition_id uuid, p_plan jsonb, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_competition public.event_sports%rowtype;
  v_old_draw public.tournament_draws%rowtype;
  v_errors text[];
  v_draw_id uuid;
  v_stage_id uuid;
  v_group_stage_id uuid;
  v_match_map jsonb := '{}'::jsonb;
  v_match jsonb;
  v_edge jsonb;
  v_round jsonb;
  v_group jsonb;
  v_slot jsonb;
  v_entry_id text;
  v_resolved_entry uuid;
  v_placeholder text;
  v_participant_id uuid;
  v_match_id uuid;
  v_target_match_id uuid;
  v_source_match_id uuid;
  v_match_count integer := 0;
  v_version integer := 1;
  v_old_positions jsonb;
  v_position jsonb;
  v_key text;
begin
  if not public.phase4_is_admin() then
    raise exception 'PE Admin access required';
  end if;

  select * into v_competition from public.event_sports where id = p_competition_id;
  if not found then raise exception 'Competition not found'; end if;

  v_errors := public.phase4_validate_plan(p_plan);
  if coalesce(array_length(v_errors, 1), 0) > 0 then
    raise exception 'Invalid tournament draw: %', array_to_string(v_errors, ' ');
  end if;

  select * into v_old_draw from public.tournament_draws
  where competition_id = p_competition_id and status in ('active', 'locked')
  order by version desc limit 1;

  if found then
    v_version := v_old_draw.version + 1;
    if v_old_draw.status = 'locked' and coalesce(btrim(p_reason), '') = '' then
      raise exception 'A locked draw requires an administrative reason to regenerate.';
    end if;
    if exists (
      select 1 from public.tournament_matches m
      where m.draw_id = v_old_draw.id
        and (m.status in ('completed', 'ongoing', 'result_submitted')
          or exists (select 1 from public.tournament_match_results r where r.match_id = m.id))
    ) and coalesce(btrim(p_reason), '') = '' then
      raise exception 'Regenerating after results require an administrative reason.';
    end if;
    select coalesce(jsonb_object_agg(node_key, position), '{}'::jsonb) into v_old_positions
    from public.tournament_node_positions where draw_id = v_old_draw.id;
    update public.tournament_draws set status = 'archived', updated_at = now()
    where id = v_old_draw.id;
  else
    v_old_positions := '{}'::jsonb;
  end if;

  insert into public.tournament_draws (
    competition_id, format, draw_mode, draw_seed, version, status, payload, generated_by
  ) values (
    p_competition_id, v_competition.tournament_format, v_competition.draw_mode,
    coalesce((p_plan->>'drawSeed')::bigint, 0), v_version, 'active',
    p_plan, auth.uid()
  ) returning id into v_draw_id;

  for v_round in select value from jsonb_array_elements(coalesce(p_plan->'rounds', '[]'::jsonb)) loop
    insert into public.tournament_stages (draw_id, stage_key, name, stage_type, sequence)
    values (
      v_draw_id, v_round.value->>'key',
      coalesce(v_round.value->>'name', v_round.value->>'key'),
      coalesce(v_round.value->>'stage_type', v_round.value->>'stage', 'knockout'),
      coalesce((v_round.value->>'roundNumber')::integer, 1)
    ) on conflict do nothing;
  end loop;

  select id into v_group_stage_id from public.tournament_stages
  where draw_id = v_draw_id and stage_type = 'group' limit 1;

  for v_group in select value from jsonb_array_elements(coalesce(p_plan->'groups', '[]'::jsonb)) loop
    insert into public.tournament_groups (stage_id, group_key, name, sort_order)
    values (
      coalesce(v_group_stage_id, (select id from public.tournament_stages where draw_id = v_draw_id limit 1)),
      v_group.value->>'key', coalesce(v_group.value->>'name', v_group.value->>'key'), 0
    ) on conflict do nothing;
  end loop;

  for v_match in select value from jsonb_array_elements(p_plan->'matches') loop
    select id into v_stage_id from public.tournament_stages
    where draw_id = v_draw_id and stage_key = coalesce(v_match.value->>'roundKey', 'r1') limit 1;

    insert into public.tournament_matches (
      draw_id, stage_id, group_id, round_key, round_name, round_number,
      match_number, status, is_bye, venue
    ) values (
      v_draw_id, v_stage_id,
      (select id from public.tournament_groups g
       where g.stage_id in (select id from public.tournament_stages where draw_id = v_draw_id)
         and g.group_key = v_match.value->>'groupKey' limit 1),
      coalesce(v_match.value->>'roundKey', 'r1'),
      coalesce(v_match.value->>'roundName', 'Match'),
      coalesce((select (value->>'roundNumber')::integer from jsonb_array_elements(p_plan->'rounds') r
                where r.value->>'key' = v_match.value->>'roundKey' limit 1), 1),
      (v_match.value->>'matchNumber')::integer,
      case when coalesce((v_match.value->>'isBye')::boolean, false) then 'completed' else 'scheduled' end,
      coalesce((v_match.value->>'isBye')::boolean, false),
      v_match.value->>'venue'
    ) returning id into v_match_id;

    v_match_map := v_match_map || jsonb_build_object(v_match.value->>'key', v_match_id::text);
    v_match_count := v_match_count + 1;

    for v_slot in select value from jsonb_array_elements(jsonb_build_array(
      v_match.value->'slotA' || jsonb_build_object('slotName', 'a'),
      v_match.value->'slotB' || jsonb_build_object('slotName', 'b')
    )) loop
      v_entry_id := nullif(v_slot.value->>'entryId', '');
      v_resolved_entry := null;
      v_placeholder := null;
      if v_entry_id is not null and v_entry_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
        v_resolved_entry := v_entry_id::uuid;
        insert into public.tournament_participants (draw_id, entry_id, seed)
        values (v_draw_id, v_resolved_entry, (v_match.value->>'seed')::integer)
        on conflict do nothing;
      elsif v_entry_id is not null then
        v_placeholder := v_entry_id;
        insert into public.tournament_participants (draw_id, placeholder_key, status)
        values (v_draw_id, v_placeholder, 'qualified')
        on conflict do nothing;
      end if;

      if v_resolved_entry is not null then
        select id into v_participant_id from public.tournament_participants
        where draw_id = v_draw_id and entry_id = v_resolved_entry;
      elsif v_placeholder is not null then
        select id into v_participant_id from public.tournament_participants
        where draw_id = v_draw_id and placeholder_key = v_placeholder;
      else
        v_participant_id := null;
      end if;

      insert into public.tournament_match_slots (
        match_id, slot, entry_id, participant_id, source_match_id, from_bye
      ) values (
        v_match_id, v_slot.value->>'slotName', v_resolved_entry, v_participant_id,
        null,
        coalesce((v_slot.value->>'fromBye')::boolean, false)
      ) on conflict (match_id, slot) do update set
        entry_id = excluded.entry_id,
        participant_id = excluded.participant_id,
        from_bye = excluded.from_bye;
    end loop;

    if coalesce((v_match.value->>'isBye')::boolean, false)
       and nullif(v_match.value->>'byeWinnerEntryId', '') is not null
       and (v_match.value->>'byeWinnerEntryId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      update public.tournament_matches
      set winner_entry_id = (v_match.value->>'byeWinnerEntryId')::uuid
      where id = v_match_id;
    end if;
  end loop;

  -- Resolve winner-source references after all matches exist.
  for v_edge in select value from jsonb_array_elements(coalesce(p_plan->'edges', '[]'::jsonb)) loop
    v_source_match_id := (v_match_map ->> (v_edge.value->>'sourceMatchKey'))::uuid;
    v_target_match_id := (v_match_map ->> (v_edge.value->>'targetMatchKey'))::uuid;
    if v_source_match_id is not null and v_target_match_id is not null then
      insert into public.tournament_graph_edges (
        draw_id, source_match_id, target_match_id, target_slot, feed
      ) values (
        v_draw_id, v_source_match_id, v_target_match_id,
        coalesce(v_edge.value->>'targetSlot', 'a'),
        coalesce(v_edge.value->>'feed', 'winner')
      ) on conflict do nothing;

      update public.tournament_match_slots
      set source_match_id = v_source_match_id
      where match_id = v_target_match_id
        and slot = coalesce(v_edge.value->>'targetSlot', 'a');
    end if;
  end loop;

  -- Reapply bye advancement into downstream slots once source edges exist.
  for v_match in select value from jsonb_array_elements(p_plan->'matches') loop
    if coalesce((v_match.value->>'isBye')::boolean, false)
       and nullif(v_match.value->>'byeWinnerEntryId', '') is not null
       and (v_match.value->>'byeWinnerEntryId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      v_source_match_id := (v_match_map ->> (v_match.value->>'key'))::uuid;
      v_resolved_entry := (v_match.value->>'byeWinnerEntryId')::uuid;
      select id into v_participant_id from public.tournament_participants
      where draw_id = v_draw_id and entry_id = v_resolved_entry;
      update public.tournament_match_slots s
      set entry_id = v_resolved_entry, participant_id = v_participant_id, from_bye = true
      from public.tournament_graph_edges e
      where e.draw_id = v_draw_id and e.source_match_id = v_source_match_id
        and s.match_id = e.target_match_id and s.slot = e.target_slot;
    end if;
  end loop;

  for v_key in select jsonb_object_keys(v_old_positions) loop
    v_position := v_old_positions -> v_key;
    insert into public.tournament_node_positions (draw_id, node_key, position)
    values (v_draw_id, v_key, v_position) on conflict do nothing;
  end loop;

  -- Seed the standings table for league and group stages.
  if v_competition.tournament_format in ('round_robin', 'group_knockout') then
    for v_match in select value from jsonb_array_elements(p_plan->'matches') loop
      for v_entry_id in select distinct nullif(value->>'entryId', '')
        from jsonb_array_elements(jsonb_build_array(v_match.value->'slotA', v_match.value->'slotB'))
        where nullif(value->>'entryId', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      loop
        insert into public.tournament_standings (draw_id, group_key, entry_id)
        values (v_draw_id, coalesce(v_match.value->>'groupKey', 'overall'), v_entry_id::uuid)
        on conflict do nothing;
      end loop;
    end loop;
  end if;

  perform public.phase3_log('tournament_draw_generated', 'event_sports', p_competition_id::text,
    jsonb_build_object('draw_id', v_draw_id, 'version', v_version, 'reason', p_reason));

  return jsonb_build_object(
    'drawId', v_draw_id, 'version', v_version, 'matchCount', v_match_count,
    'status', 'active'
  );
end;
$$;

create or replace function public.phase4_save_node_positions(
  p_draw_id uuid, p_positions jsonb
) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_key text;
  v_count integer := 0;
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  if p_positions is null or jsonb_typeof(p_positions) <> 'object' then
    raise exception 'Invalid node positions';
  end if;
  for v_key in select jsonb_object_keys(p_positions) loop
    if v_key !~ '^(match|participant|round):' then
      raise exception 'Invalid canvas node key';
    end if;
    insert into public.tournament_node_positions (draw_id, node_key, position)
    values (p_draw_id, v_key, p_positions -> v_key)
    on conflict (draw_id, node_key) do update set position = excluded.position, updated_at = now();
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.phase4_set_draw_lock(
  p_draw_id uuid, p_locked boolean, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_competition_id uuid;
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  if not p_locked and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Unlocking a bracket requires a reason.';
  end if;
  update public.tournament_draws
  set status = case when p_locked then 'locked' else 'active' end,
      locked_at = case when p_locked then now() else null end,
      locked_by = case when p_locked then auth.uid() else null end,
      lock_reason = p_reason, updated_at = now()
  where id = p_draw_id returning competition_id into v_competition_id;
  if v_competition_id is null then raise exception 'Draw not found'; end if;
  perform public.phase3_log('tournament_draw_lock_changed', 'tournament_draws', p_draw_id::text,
    jsonb_build_object('locked', p_locked, 'reason', p_reason));
end;
$$;

create or replace function public.phase4_submit_match_result(
  p_match_id uuid, p_result jsonb, p_require_approval boolean default false
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_match public.tournament_matches%rowtype;
  v_competition public.event_sports%rowtype;
  v_winner uuid;
  v_slot_a uuid;
  v_slot_b uuid;
  v_result_id uuid;
  v_advanced integer := 0;
  v_notify uuid[];
  v_edge record;
  v_is_admin boolean := public.phase4_is_admin();
begin
  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.is_bye then raise exception 'Bye matches have no result to submit.'; end if;
  if v_match.status in ('completed', 'cancelled') then
    raise exception 'This match result is already finalised.';
  end if;
  if exists (select 1 from public.tournament_match_results r where r.match_id = p_match_id) then
    raise exception 'Use an audited correction to change a submitted result.';
  end if;

  select s into v_competition from public.event_sports s
  join public.tournament_draws d on d.competition_id = s.id
  where d.id = v_match.draw_id;

  if not v_is_admin then
    if not public.phase4_has_sport_access(v_competition.id) then
      raise exception 'You are not assigned to this sport.';
    end if;
    if not exists (
      select 1 from public.sport_organizer_assignments a
      where a.competition_id = v_competition.id and a.user_id = auth.uid()
        and a.status = 'active' and a.can_submit_results) then
      raise exception 'Result submission is not permitted for this assignment.';
    end if;
    if v_match.organizer_id is not null and v_match.organizer_id <> auth.uid() then
      raise exception 'This match is assigned to another organiser.';
    end if;
  end if;

  select s.entry_id into v_slot_a from public.tournament_match_slots s where s.match_id = p_match_id and s.slot = 'a';
  select s.entry_id into v_slot_b from public.tournament_match_slots s where s.match_id = p_match_id and s.slot = 'b';
  v_winner := nullif(p_result->>'winnerEntryId', '')::uuid;
  if v_winner is null or v_winner not in (v_slot_a, v_slot_b) then
    raise exception 'The selected winner is not part of this match.';
  end if;

  insert into public.tournament_match_results (
    match_id, score_a, score_b, breakdown, winner_entry_id, result_note,
    submitted_by, is_authoritative
  ) values (
    p_match_id,
    nullif(p_result->>'scoreA', '')::numeric,
    nullif(p_result->>'scoreB', '')::numeric,
    coalesce(p_result->'breakdown', '[]'::jsonb),
    v_winner,
    nullif(p_result->>'notes', ''),
    auth.uid(),
    not p_require_approval
  ) returning id into v_result_id;

  update public.tournament_matches
  set status = case when p_require_approval then 'result_submitted' else 'completed' end,
      winner_entry_id = v_winner, updated_at = now()
  where id = p_match_id;

  insert into public.tournament_match_result_history (match_id, result_id, actor_id, action, details)
  values (p_match_id, v_result_id, auth.uid(), 'submitted', p_result);

  if not p_require_approval then
    for v_edge in
      select e.* from public.tournament_graph_edges e
      where e.source_match_id = p_match_id and e.feed = 'winner'
    loop
      update public.tournament_match_slots s
      set entry_id = v_winner,
          participant_id = (select id from public.tournament_participants
                            where draw_id = v_match.draw_id and entry_id = v_winner),
          from_bye = false
      where s.match_id = v_edge.target_match_id and s.slot = v_edge.target_slot;
      v_advanced := v_advanced + 1;
    end loop;

    update public.tournament_participants
    set status = 'qualified'
    where draw_id = v_match.draw_id and entry_id = v_winner and status = 'active';

    if v_competition.tournament_format in ('round_robin', 'group_knockout') then
      update public.tournament_standings st
      set played = st.played + 1,
          wins = st.wins + case when st.entry_id = v_winner then 1 else 0 end,
          losses = st.losses + case when st.entry_id = v_winner then 0 else 1 end,
          points_for = st.points_for + case when st.entry_id = v_winner
            then coalesce(nullif(p_result->>'scoreA', '')::numeric, 0)
            else coalesce(nullif(p_result->>'scoreB', '')::numeric, 0) end,
          points_against = st.points_against + case when st.entry_id = v_winner
            then coalesce(nullif(p_result->>'scoreB', '')::numeric, 0)
            else coalesce(nullif(p_result->>'scoreA', '')::numeric, 0) end,
          updated_at = now()
      where st.draw_id = v_match.draw_id
        and st.entry_id in (v_slot_a, v_slot_b)
        and (v_match.group_id is null or st.group_id = v_match.group_id);

      update public.tournament_standings st
      set competition_points = st.wins * coalesce((v_competition.points->>'win')::numeric, 3)
            + st.draws * coalesce((v_competition.points->>'draw')::numeric, 1)
            + st.losses * coalesce((v_competition.points->>'loss')::numeric, 0),
          point_difference = st.points_for - st.points_against,
          updated_at = now()
      where st.draw_id = v_match.draw_id and st.entry_id in (v_slot_a, v_slot_b);
    end if;
  end if;

  select coalesce(array_agg(distinct e.captain_user_id), '{}'::uuid[]) into v_notify
  from public.competition_entries e
  where e.id in (v_slot_a, v_slot_b) and e.captain_user_id is not null;
  perform public.phase4_notify_users(
    v_notify, 'Match result submitted',
    'A result was submitted for match ' || v_match.match_number || '.',
    'future_event', '/events');

  if not v_is_admin then
    insert into public.organizer_activity_logs (competition_id, user_id, match_id, action, details)
    values (v_competition.id, auth.uid(), p_match_id, 'result_submitted',
      jsonb_build_object('resultId', v_result_id, 'winnerEntryId', v_winner));
  end if;

  return jsonb_build_object(
    'resultId', v_result_id, 'winnerEntryId', v_winner,
    'advanced', v_advanced, 'status', v_match.status
  );
end;
$$;

create or replace function public.phase4_correct_match_result(
  p_match_id uuid, p_result jsonb, p_reason text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_match public.tournament_matches%rowtype;
  v_old public.tournament_match_results%rowtype;
  v_winner uuid;
  v_result_id uuid;
  v_edge record;
  v_slot_a uuid;
  v_slot_b uuid;
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A correction reason is required.'; end if;
  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  select * into v_old from public.tournament_match_results where match_id = p_match_id;
  if found then
    insert into public.tournament_match_result_history (match_id, result_id, actor_id, action, details)
    values (p_match_id, v_old.id, auth.uid(), 'corrected',
      jsonb_build_object('reason', p_reason, 'previous', to_jsonb(v_old)));
  end if;

  select s.entry_id into v_slot_a from public.tournament_match_slots s where s.match_id = p_match_id and s.slot = 'a';
  select s.entry_id into v_slot_b from public.tournament_match_slots s where s.match_id = p_match_id and s.slot = 'b';
  v_winner := nullif(p_result->>'winnerEntryId', '')::uuid;
  if v_winner is null or v_winner not in (v_slot_a, v_slot_b) then
    raise exception 'The selected winner is not part of this match.';
  end if;

  insert into public.tournament_match_results (
    match_id, score_a, score_b, breakdown, winner_entry_id, result_note,
    submitted_by, is_authoritative, approved_by, approved_at
  ) values (
    p_match_id, nullif(p_result->>'scoreA', '')::numeric,
    nullif(p_result->>'scoreB', '')::numeric,
    coalesce(p_result->'breakdown', '[]'::jsonb), v_winner,
    nullif(p_result->>'notes', ''), auth.uid(), true, auth.uid(), now()
  ) on conflict (match_id) do update set
    score_a = excluded.score_a, score_b = excluded.score_b,
    breakdown = excluded.breakdown, winner_entry_id = excluded.winner_entry_id,
    result_note = excluded.result_note, approved_by = excluded.approved_by,
    approved_at = excluded.approved_at, updated_at = now()
  returning id into v_result_id;

  update public.tournament_matches
  set status = 'completed', winner_entry_id = v_winner, updated_at = now()
  where id = p_match_id;

  for v_edge in
    select e.* from public.tournament_graph_edges e where e.source_match_id = p_match_id and e.feed = 'winner'
  loop
    update public.tournament_match_slots s
    set entry_id = v_winner,
        participant_id = (select id from public.tournament_participants
                          where draw_id = v_match.draw_id and entry_id = v_winner)
    where s.match_id = v_edge.target_match_id and s.slot = v_edge.target_slot;
  end loop;

  perform public.phase3_log('match_result_corrected', 'tournament_matches', p_match_id::text,
    jsonb_build_object('reason', p_reason, 'winner', v_winner));
  return jsonb_build_object('resultId', v_result_id, 'winnerEntryId', v_winner, 'corrected', true);
end;
$$;

create or replace function public.phase4_admin_update_match(
  p_match_id uuid, p_data jsonb, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_match public.tournament_matches%rowtype;
  v_notify uuid[];
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  select * into v_match from public.tournament_matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;

  update public.tournament_matches set
    starts_at = case when p_data ? 'startsAt' then nullif(p_data->>'startsAt', '')::timestamptz else starts_at end,
    ends_at = case when p_data ? 'endsAt' then nullif(p_data->>'endsAt', '')::timestamptz else ends_at end,
    venue = case when p_data ? 'venue' then nullif(p_data->>'venue', '') else venue end,
    status = case when p_data ? 'status' then p_data->>'status' else status end,
    organizer_id = case when p_data ? 'organizerId' then nullif(p_data->>'organizerId', '')::uuid else organizer_id end,
    notes = case when p_data ? 'notes' then nullif(p_data->>'notes', '') else notes end,
    updated_at = now()
  where id = p_match_id;

  if p_data ? 'calendarEventId' then
    insert into public.phase4_calendar_links (source_type, source_id, calendar_event_id)
    values ('match', p_match_id, (p_data->>'calendarEventId')::uuid)
    on conflict (source_type, source_id) do update set calendar_event_id = excluded.calendar_event_id;
    update public.tournament_matches
    set calendar_event_id = (p_data->>'calendarEventId')::uuid where id = p_match_id;
  end if;

  select coalesce(array_agg(distinct e.captain_user_id), '{}'::uuid[]) into v_notify
  from public.competition_entries e
  join public.tournament_match_slots s on s.entry_id = e.id
  where s.match_id = p_match_id and e.captain_user_id is not null;
  perform public.phase4_notify_users(
    v_notify, 'Match schedule updated',
    'Match ' || v_match.match_number || ' schedule was updated.',
    'calendar', '/events');

  perform public.phase3_log('match_admin_updated', 'tournament_matches', p_match_id::text,
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.phase4_organizer_update_match(
  p_match_id uuid, p_data jsonb
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_match public.tournament_matches%rowtype;
  v_competition_id uuid;
  v_status text;
begin
  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  select d.competition_id into v_competition_id from public.tournament_draws d where d.id = v_match.draw_id;
  if not public.phase4_is_admin() then
    if not public.phase4_has_sport_access(v_competition_id) then
      raise exception 'You are not assigned to this sport.';
    end if;
    if v_match.organizer_id is not null and v_match.organizer_id <> auth.uid() then
      raise exception 'This match is assigned to another organiser.';
    end if;
  end if;
  if exists (select 1 from public.tournament_match_results r where r.match_id = p_match_id) then
    raise exception 'A submitted result cannot be changed through match management.';
  end if;

  v_status := case when p_data ? 'status' then p_data->>'status' else v_match.status end;
  if v_status not in ('scheduled', 'ready', 'ongoing', 'postponed', 'cancelled', 'disputed') then
    raise exception 'Unsupported match status.';
  end if;

  update public.tournament_matches set
    status = v_status,
    starts_at = case when p_data ? 'startsAt' then nullif(p_data->>'startsAt', '')::timestamptz else starts_at end,
    ends_at = case when p_data ? 'endsAt' then nullif(p_data->>'endsAt', '')::timestamptz else ends_at end,
    venue = case when p_data ? 'venue' then nullif(p_data->>'venue', '') else venue end,
    notes = case when p_data ? 'notes' then nullif(p_data->>'notes', '') else notes end,
    updated_at = now()
  where id = p_match_id;

  insert into public.organizer_activity_logs (competition_id, user_id, match_id, action, details)
  values (v_competition_id, auth.uid(), p_match_id, 'match_updated', p_data);
end;
$$;

create or replace function public.phase4_create_organizer_invitation(
  p_competition_id uuid, p_student_directory_id uuid, p_expires_hours integer default 72
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
  v_directory public.student_directory%rowtype;
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  select * into v_directory from public.student_directory where id = p_student_directory_id and is_active;
  if not found then raise exception 'The selected student is not in the active directory.'; end if;
  if p_expires_hours is null or p_expires_hours not between 1 and 720 then
    raise exception 'Invitation expiry must be between 1 and 720 hours.';
  end if;

  v_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_expires_at := now() + make_interval(hours => p_expires_hours);

  insert into public.organizer_invitations (
    competition_id, student_directory_id, token_hash, assigned_by, expires_at
  ) values (
    p_competition_id, p_student_directory_id,
    encode(digest(v_token, 'sha256'), 'hex'), auth.uid(), v_expires_at
  ) returning id into v_invitation_id;

  perform public.phase3_log('organizer_invitation_created', 'organizer_invitations', v_invitation_id::text,
    jsonb_build_object('competitionId', p_competition_id, 'studentDirectoryId', p_student_directory_id));

  return jsonb_build_object(
    'invitationId', v_invitation_id, 'token', v_token,
    'expiresAt', v_expires_at, 'studentName', v_directory.full_name
  );
end;
$$;

create or replace function public.phase4_accept_organizer_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_invitation public.organizer_invitations%rowtype;
  v_directory_id uuid;
  v_assignment_id uuid;
begin
  if p_token is null or btrim(p_token) = '' then raise exception 'Invalid invitation.'; end if;
  select public.student_directory_id_for_user() into v_directory_id;
  if v_directory_id is null then raise exception 'Your account is not linked to the student directory.'; end if;

  select * into v_invitation from public.organizer_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    for update;
  if not found or v_invitation.accepted_at is not null or v_invitation.revoked_at is not null
     or v_invitation.expires_at <= now() then
    raise exception 'This invitation is invalid, expired or already used.';
  end if;
  if v_invitation.student_directory_id <> v_directory_id then
    raise exception 'This invitation was issued to a different student.';
  end if;

  insert into public.sport_organizer_assignments (
    competition_id, user_id, student_directory_id, assigned_by
  ) values (
    v_invitation.competition_id, auth.uid(), v_invitation.student_directory_id, v_invitation.assigned_by
  ) on conflict (competition_id, user_id) do update set
    status = 'active', revoked_at = null
  returning id into v_assignment_id;

  update public.organizer_invitations
  set accepted_at = now(), accepted_by = auth.uid() where id = v_invitation.id;

  insert into public.organizer_activity_logs (competition_id, user_id, action, details)
  values (v_invitation.competition_id, auth.uid(), 'invitation_accepted',
    jsonb_build_object('assignmentId', v_assignment_id));

  return jsonb_build_object(
    'assignmentId', v_assignment_id, 'competitionId', v_invitation.competition_id,
    'status', 'active'
  );
end;
$$;

create or replace function public.phase4_revoke_organizer_assignment(
  p_assignment_id uuid, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_competition_id uuid;
  v_user_id uuid;
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  update public.sport_organizer_assignments
  set status = 'revoked', revoked_at = now()
  where id = p_assignment_id and status = 'active'
  returning competition_id, user_id into v_competition_id, v_user_id;
  if v_competition_id is null then raise exception 'Assignment not found'; end if;
  insert into public.organizer_activity_logs (competition_id, user_id, action, details)
  values (v_competition_id, v_user_id, 'assignment_revoked', jsonb_build_object('reason', p_reason));
  perform public.phase3_log('organizer_assignment_revoked', 'sport_organizer_assignments',
    p_assignment_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.phase4_revoke_organizer_invitation(
  p_invitation_id uuid, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  update public.organizer_invitations set revoked_at = now()
  where id = p_invitation_id and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Invitation not found or already used'; end if;
  perform public.phase3_log('organizer_invitation_revoked', 'organizer_invitations',
    p_invitation_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.phase4_submit_entry(
  p_competition_id uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_competition public.event_sports%rowtype;
  v_rules public.competition_rules%rowtype;
  v_settings public.competition_payment_settings%rowtype;
  v_profile public.profiles%rowtype;
  v_member jsonb;
  v_directory public.student_directory%rowtype;
  v_entry_id uuid;
  v_member_ids uuid[] := '{}';
  v_usns text[] := '{}';
  v_usn text;
  v_count integer;
  v_snapshot jsonb;
  v_kind text;
  v_captain_usn text;
  v_eligibility jsonb;
  v_rule jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to register.'; end if;
  select * into v_competition from public.event_sports where id = p_competition_id;
  if not found then raise exception 'Competition not found'; end if;
  if v_competition.status <> 'registration_open' then
    raise exception 'Registration is not open for this competition.';
  end if;
  if v_competition.registration_start is not null and now() < v_competition.registration_start then
    raise exception 'Registration has not opened yet.';
  end if;
  if v_competition.registration_deadline is not null and now() > v_competition.registration_deadline then
    raise exception 'The registration deadline has passed.';
  end if;

  select * into v_rules from public.competition_rules where competition_id = p_competition_id;
  select * into v_settings from public.competition_payment_settings where competition_id = p_competition_id;
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.student_directory_id is null or v_profile.verification_status <> 'verified' then
    raise exception 'A verified student account is required to register.';
  end if;

  v_kind := coalesce(p_payload->>'kind', v_competition.mode);
  if v_kind not in ('team', 'individual') or v_kind <> v_competition.mode then
    raise exception 'This competition does not accept that entry type.';
  end if;
  if jsonb_array_length(coalesce(p_payload->'members', '[]'::jsonb)) = 0 then
    raise exception 'At least one participant is required.';
  end if;
  if v_kind = 'team' and coalesce(v_rules.captain_required, true)
     and nullif(p_payload->>'captainUsn', '') is null then
    raise exception 'A captain USN is required.';
  end if;
  if v_kind = 'team' and coalesce(v_rules.min_team_size, 1) > jsonb_array_length(p_payload->'members') then
    raise exception 'The team is below the minimum size.';
  end if;
  if v_kind = 'team' and v_rules.max_team_size is not null
     and jsonb_array_length(p_payload->'members') > v_rules.max_team_size then
    raise exception 'The team exceeds the maximum size.';
  end if;
  if v_kind = 'individual' and jsonb_array_length(p_payload->'members') <> 1 then
    raise exception 'An individual entry must contain exactly one competitor.';
  end if;

  v_captain_usn := upper(btrim(coalesce(p_payload->>'captainUsn', '')));
  for v_member in select value from jsonb_array_elements(p_payload->'members') loop
    v_usn := public.normalize_usn(coalesce(v_member->>'usn', ''));
    if v_usn is null or v_usn = any(v_usns) then
      raise exception 'Duplicate or invalid participant USN.';
    end if;
    v_usns := array_append(v_usns, v_usn);
    select * into v_directory from public.student_directory
    where usn = v_usn and is_active;
    if not found then raise exception 'A participant USN is not in the official directory: %', v_usn; end if;
    if v_captain_usn = '' and coalesce((v_member->>'isCaptain')::boolean, false) then
      v_captain_usn := v_usn;
    end if;

    for v_rule in select value from public.competition_eligibility_rules
      where competition_id = p_competition_id and is_active loop
      if v_rule.value->>'rule_type' = 'department'
         and not (v_directory.department_id::text = any(
           array(select jsonb_array_elements_text(v_rule.value->'departments')))) then
        raise exception 'A participant does not meet the department eligibility rule.';
      end if;
      if v_rule.value->>'rule_type' = 'semester'
         and v_directory.semester < coalesce((v_rule.value->>'min')::smallint, 1) then
        raise exception 'A participant does not meet the semester eligibility rule.';
      end if;
      if v_rule.value->>'rule_type' = 'academic_year'
         and v_directory.academic_year < coalesce((v_rule.value->>'min')::smallint, 1) then
        raise exception 'A participant does not meet the academic year rule.';
      end if;
      if v_rule.value->>'rule_type' = 'min_weight'
         and coalesce((v_member->>'weightKg')::numeric, 0) < (v_rule.value->>'value')::numeric then
        raise exception 'A participant is below the required weight.';
      end if;
      if v_rule.value->>'rule_type' = 'max_weight'
         and coalesce((v_member->>'weightKg')::numeric, 0) > (v_rule.value->>'value')::numeric then
        raise exception 'A participant exceeds the maximum weight.';
      end if;
    end loop;
  end loop;

  if v_captain_usn <> public.normalize_usn(v_profile.requested_usn)
     and not exists (
       select 1 from public.student_directory d
       where d.id = v_profile.student_directory_id and d.usn = v_captain_usn) then
    raise exception 'The captain must be the signed-in student.';
  end if;

  if v_competition.max_entries is not null then
    select count(*) into v_count from public.competition_entries
    where competition_id = p_competition_id and status <> 'withdrawn';
    if v_count >= v_competition.max_entries then
      raise exception 'This competition is full.';
    end if;
  end if;
  if not v_rules.allow_duplicate_player_other_team then
    if exists (
      select 1 from public.competition_entry_members m
      join public.competition_entries e on e.id = m.entry_id
      where e.competition_id = p_competition_id and e.status <> 'withdrawn'
        and m.usn = any(v_usns)) then
      raise exception 'A participant is already registered in this competition.';
    end if;
  end if;

  select coalesce(jsonb_object_agg(r.rule_type, r.rule_value), '{}'::jsonb) into v_eligibility
  from public.competition_eligibility_rules r
  where r.competition_id = p_competition_id and r.is_active;
  v_snapshot := jsonb_build_object(
    'competition', to_jsonb(v_competition), 'rules', to_jsonb(v_rules),
    'eligibility', v_eligibility, 'capturedAt', now()
  );

  insert into public.competition_entries (
    competition_id, kind, team_name, captain_user_id, captain_directory_id,
    contact_email, contact_phone, status, payment_status, rules_snapshot, answers,
    submitted_at, created_by, seed
  ) values (
    p_competition_id, v_kind,
    nullif(btrim(coalesce(p_payload->>'teamName', '')), ''),
    auth.uid(), (select id from public.student_directory where usn = v_captain_usn),
    nullif(p_payload->>'contactEmail', ''), nullif(p_payload->>'contactPhone', ''),
    'submitted',
    case when coalesce(v_settings.is_required, false) then 'pending_verification' else 'not_required' end,
    v_snapshot, coalesce(p_payload->'answers', '{}'::jsonb), now(), auth.uid(),
    nullif(p_payload->>'seed', '')::integer
  ) returning id into v_entry_id;

  for v_member in select value from jsonb_array_elements(p_payload->'members') loop
    v_usn := public.normalize_usn(v_member->>'usn');
    select * into v_directory from public.student_directory where usn = v_usn and is_active;
    insert into public.competition_entry_members (
      entry_id, student_directory_id, user_id, full_name, usn, department_id,
      semester, academic_year, weight_kg, is_captain, is_substitute,
      confirmation_status, metadata
    ) values (
      v_entry_id, v_directory.id,
      (select id from public.profiles where student_directory_id = v_directory.id and account_status = 'active' limit 1),
      v_directory.full_name, v_directory.usn, v_directory.department_id,
      v_directory.semester, v_directory.academic_year,
      nullif(v_member->>'weightKg', '')::numeric,
      v_usn = v_captain_usn,
      coalesce((v_member->>'isSubstitute')::boolean, false),
      case when coalesce(v_rules.require_member_confirmation, false)
        then 'pending' else 'verified' end,
      coalesce(v_member->'metadata', '{}'::jsonb)
    );
  end loop;

  insert into public.registration_history (entry_id, actor_id, action, to_status, details)
  values (v_entry_id, auth.uid(), 'submitted', 'submitted',
    jsonb_build_object('members', coalesce(jsonb_array_length(p_payload->'members'), 0)));

  perform public.phase4_notify_users(
    array[auth.uid()], 'Registration submitted',
    'Your entry for ' || v_competition.name || ' was submitted for review.',
    'future_event', '/my-events');

  return jsonb_build_object('entryId', v_entry_id, 'status', 'submitted');
end;
$$;

create or replace function public.phase4_review_entry(
  p_entry_id uuid, p_status text, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_entry public.competition_entries%rowtype;
  v_competition public.event_sports%rowtype;
  v_status text;
  v_users uuid[];
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  if p_status not in ('under_review', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'submitted') then
    raise exception 'Unsupported registration status';
  end if;
  select * into v_entry from public.competition_entries where id = p_entry_id for update;
  if not found then raise exception 'Registration not found'; end if;
  select * into v_competition from public.event_sports where id = v_entry.competition_id;
  v_status := p_status;

  if v_status = 'approved' and v_competition.max_entries is not null then
    if (select count(*) from public.competition_entries
        where competition_id = v_entry.competition_id and status = 'approved') >= v_competition.max_entries
       and v_entry.status <> 'approved' then
      v_status := 'waitlisted';
    end if;
  end if;

  update public.competition_entries
  set status = v_status,
      reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = case when v_status = 'rejected' then p_note else rejection_reason end,
      correction_note = case when v_status = 'submitted' then p_note else correction_note end,
      updated_at = now()
  where id = p_entry_id;

  insert into public.registration_history (entry_id, actor_id, action, from_status, to_status, details)
  values (p_entry_id, auth.uid(), 'reviewed', v_entry.status, v_status,
    jsonb_build_object('note', p_note));

  v_users := array_remove(array[v_entry.captain_user_id], null);
  perform public.phase4_notify_users(
    v_users, 'Registration ' || v_status,
    'Your entry for ' || v_competition.name || ' is now ' || replace(v_status, '_', ' ') || '.',
    'future_event', '/my-events');

  perform public.phase3_log('registration_reviewed', 'competition_entries', p_entry_id::text,
    jsonb_build_object('from', v_entry.status, 'to', v_status, 'note', p_note));
  return jsonb_build_object('entryId', p_entry_id, 'status', v_status);
end;
$$;

create or replace function public.phase4_verify_payment(
  p_payment_id uuid, p_status text, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_payment public.competition_payment_records%rowtype;
  v_entry public.competition_entries%rowtype;
  v_competition public.event_sports%rowtype;
begin
  if not public.phase4_is_admin() then raise exception 'PE Admin access required'; end if;
  if p_status not in ('verified', 'rejected', 'waived', 'refunded', 'pending_verification', 'not_required') then
    raise exception 'Unsupported payment status';
  end if;
  select * into v_payment from public.competition_payment_records where id = p_payment_id for update;
  if not found then raise exception 'Payment record not found'; end if;
  select * into v_entry from public.competition_entries where id = v_payment.entry_id;
  select * into v_competition from public.event_sports where id = v_entry.competition_id;

  update public.competition_payment_records
  set status = p_status, note = coalesce(p_note, note),
      verified_by = auth.uid(),
      verified_at = case when p_status in ('verified', 'rejected', 'waived', 'refunded')
        then now() else null end,
      updated_at = now()
  where id = p_payment_id;

  update public.competition_entries
  set payment_status = p_status, updated_at = now() where id = v_payment.entry_id;

  insert into public.payment_verification_history (payment_id, actor_id, action, from_status, to_status, note)
  values (p_payment_id, auth.uid(), 'verified', v_payment.status, p_status, p_note);

  perform public.phase4_notify_users(
    array_remove(array[v_entry.captain_user_id], null),
    'Payment ' || p_status,
    'Payment for ' || v_competition.name || ' is now ' || replace(p_status, '_', ' ') || '.',
    'future_event', '/my-events');

  perform public.phase3_log('payment_verified', 'competition_payment_records', p_payment_id::text,
    jsonb_build_object('from', v_payment.status, 'to', p_status, 'note', p_note));
  return jsonb_build_object('paymentId', p_payment_id, 'status', p_status);
end;
$$;

create or replace function public.phase4_submit_payment_proof(
  p_entry_id uuid, p_proof_file_id uuid, p_transaction_reference text default null,
  p_claimed_amount numeric default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_entry public.competition_entries%rowtype;
  v_settings public.competition_payment_settings%rowtype;
  v_payment_id uuid;
  v_admins uuid[];
begin
  if auth.uid() is null then raise exception 'Sign in to submit payment proof.'; end if;
  if not public.phase4_owns_entry(p_entry_id) then
    raise exception 'You cannot submit payment for this entry.';
  end if;
  select * into v_entry from public.competition_entries where id = p_entry_id for update;
  if not found then raise exception 'Registration not found.'; end if;
  if v_entry.status in ('withdrawn', 'rejected') then
    raise exception 'This registration cannot be paid.';
  end if;
  select * into v_settings from public.competition_payment_settings
    where competition_id = v_entry.competition_id;
  if coalesce(v_settings.is_required, false) is false then
    raise exception 'Payment is not required for this competition.';
  end if;
  if not exists (
    select 1 from public.phase4_files f
    where f.id = p_proof_file_id and f.parent_type = 'payment_proof'
      and f.parent_id = p_entry_id and f.uploader_id = auth.uid()
      and f.upload_status = 'confirmed') then
    raise exception 'Attach a confirmed payment proof for this registration.';
  end if;

  insert into public.competition_payment_records (
    entry_id, proof_file_id, transaction_reference, claimed_amount,
    status, note, verified_by, verified_at
  ) values (
    p_entry_id, p_proof_file_id, nullif(btrim(coalesce(p_transaction_reference, '')), ''),
    p_claimed_amount, 'pending_verification', null, null, null
  ) on conflict (entry_id) do update set
    proof_file_id = excluded.proof_file_id,
    transaction_reference = excluded.transaction_reference,
    claimed_amount = excluded.claimed_amount,
    status = 'pending_verification', note = null,
    verified_by = null, verified_at = null, updated_at = now()
  returning id into v_payment_id;

  update public.competition_entries
  set payment_status = 'pending_verification', updated_at = now()
  where id = p_entry_id;

  insert into public.payment_verification_history (payment_id, actor_id, action, to_status, note)
  values (v_payment_id, auth.uid(), 'proof_submitted', 'pending_verification', null);

  select coalesce(array_agg(ur.user_id), '{}'::uuid[]) into v_admins
  from public.user_roles ur where ur.role = 'pe_admin';
  perform public.phase4_notify_users(
    v_admins, 'Payment proof submitted',
    'A payment proof is waiting for verification.', 'future_event', '/admin/events/dashboard');

  return jsonb_build_object('paymentId', v_payment_id, 'status', 'pending_verification');
end;
$$;

create or replace function public.phase4_respond_participant_invitation(
  p_token text, p_accept boolean
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_invitation public.participant_invitations%rowtype;
  v_entry public.competition_entries%rowtype;
begin
  select * into v_invitation from public.participant_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_invitation.accepted_at is not null or v_invitation.revoked_at is not null
     or v_invitation.expires_at <= now() then
    raise exception 'This participation request is invalid or expired.';
  end if;
  if not exists (
    select 1 from public.competition_entry_members m
    where m.id = v_invitation.member_id and m.user_id = auth.uid()) then
    raise exception 'This participation request belongs to another student.';
  end if;
  update public.participant_invitations set accepted_at = now() where id = v_invitation.id;
  update public.competition_entry_members
  set confirmation_status = case when p_accept then 'accepted' else 'declined' end,
      confirmed_at = now()
  where id = v_invitation.member_id;
  select * into v_entry from public.competition_entries where id = v_invitation.entry_id;
  return jsonb_build_object('entryId', v_entry.id, 'accepted', p_accept);
end;
$$;

/* ------------------------------------------------------------------------- */
/* RPC grants                                                                 */
/* ------------------------------------------------------------------------- */

revoke all on function public.phase4_validate_plan(jsonb) from public;
revoke all on function public.phase4_save_draw(uuid, jsonb, text) from public;
revoke all on function public.phase4_save_node_positions(uuid, jsonb) from public;
revoke all on function public.phase4_set_draw_lock(uuid, boolean, text) from public;
revoke all on function public.phase4_submit_match_result(uuid, jsonb, boolean) from public;
revoke all on function public.phase4_correct_match_result(uuid, jsonb, text) from public;
revoke all on function public.phase4_admin_update_match(uuid, jsonb, text) from public;
revoke all on function public.phase4_organizer_update_match(uuid, jsonb) from public;
revoke all on function public.phase4_create_organizer_invitation(uuid, uuid, integer) from public;
revoke all on function public.phase4_accept_organizer_invitation(text) from public;
revoke all on function public.phase4_revoke_organizer_assignment(uuid, text) from public;
revoke all on function public.phase4_revoke_organizer_invitation(uuid, text) from public;
revoke all on function public.phase4_submit_entry(uuid, jsonb) from public;
revoke all on function public.phase4_review_entry(uuid, text, text) from public;
revoke all on function public.phase4_verify_payment(uuid, text, text) from public;
revoke all on function public.phase4_submit_payment_proof(uuid, uuid, text, numeric) from public;
revoke all on function public.phase4_respond_participant_invitation(text, boolean) from public;

grant execute on function public.phase4_validate_plan(jsonb) to authenticated;
grant execute on function public.phase4_save_draw(uuid, jsonb, text) to authenticated;
grant execute on function public.phase4_save_node_positions(uuid, jsonb) to authenticated;
grant execute on function public.phase4_set_draw_lock(uuid, boolean, text) to authenticated;
grant execute on function public.phase4_submit_match_result(uuid, jsonb, boolean) to authenticated;
grant execute on function public.phase4_correct_match_result(uuid, jsonb, text) to authenticated;
grant execute on function public.phase4_admin_update_match(uuid, jsonb, text) to authenticated;
grant execute on function public.phase4_organizer_update_match(uuid, jsonb) to authenticated;
grant execute on function public.phase4_create_organizer_invitation(uuid, uuid, integer) to authenticated;
grant execute on function public.phase4_accept_organizer_invitation(text) to authenticated;
grant execute on function public.phase4_revoke_organizer_assignment(uuid, text) to authenticated;
grant execute on function public.phase4_revoke_organizer_invitation(uuid, text) to authenticated;
grant execute on function public.phase4_submit_entry(uuid, jsonb) to authenticated;
grant execute on function public.phase4_review_entry(uuid, text, text) to authenticated;
grant execute on function public.phase4_verify_payment(uuid, text, text) to authenticated;
grant execute on function public.phase4_submit_payment_proof(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.phase4_respond_participant_invitation(text, boolean) to authenticated;

grant execute on function public.phase4_is_admin() to authenticated;
grant execute on function public.phase4_has_sport_access(uuid, uuid) to authenticated;
grant execute on function public.phase4_event_is_public(uuid) to anon, authenticated;
grant execute on function public.phase4_competition_is_public(uuid) to anon, authenticated;
grant execute on function public.phase4_can_view_file(uuid) to anon, authenticated;

alter publication supabase_realtime add table public.tournament_matches;
alter publication supabase_realtime add table public.competition_entries;

/* ------------------------------------------------------------------------- */
/* R2 metadata RPCs — private objects, signed URLs only                       */
/* ------------------------------------------------------------------------- */

create or replace function public.phase4_authorize_upload(
  p_parent_type text, p_parent_id uuid, p_original_filename text,
  p_content_type text, p_byte_size bigint, p_visibility text default 'private'
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_admin boolean := public.phase4_is_admin();
  v_extension text;
  v_key text;
  v_file_id uuid;
  v_object_visibility text := 'private';
begin
  if auth.uid() is null then raise exception 'Sign in to upload files.'; end if;
  if p_parent_type not in (
    'event_banner', 'event_logo', 'sport_image', 'payment_qr',
    'payment_proof', 'team_document', 'participant_document') then
    raise exception 'Unsupported file category';
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 10485760 then
    raise exception 'Files must be between 1 byte and 10 MB.';
  end if;
  if p_content_type not in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf') then
    raise exception 'Only PNG, JPEG, WebP and PDF files are accepted.';
  end if;

  v_extension := lower(substring(btrim(p_original_filename) from '\.([a-z0-9]{2,5})$'));
  if v_extension is null then
    v_extension := case p_content_type
      when 'image/png' then 'png' when 'image/jpeg' then 'jpg'
      when 'image/webp' then 'webp' else 'pdf' end;
  end if;

  if p_parent_type in ('event_banner', 'event_logo', 'sport_image', 'payment_qr') then
    if not v_admin then raise exception 'Only PE Admin can upload this file category.'; end if;
    if not exists (select 1 from public.event_sports where id = p_parent_id)
       and not exists (select 1 from public.sports_events where id = p_parent_id) then
      raise exception 'Upload target not found';
    end if;
    v_object_visibility := 'public';
  else
    if not public.phase4_owns_entry(p_parent_id) and not v_admin then
      raise exception 'You cannot upload a document for this entry.';
    end if;
    if p_parent_type = 'payment_proof' then v_object_visibility := 'private'; end if;
  end if;

  v_key := 'phase4/' || p_parent_type || '/' || p_parent_id::text || '/'
    || gen_random_uuid()::text || '.' || v_extension;
  insert into public.phase4_files (
    object_key, original_filename, content_type, byte_size, uploader_id,
    parent_type, parent_id, visibility, upload_status
  ) values (
    v_key, left(btrim(p_original_filename), 200), p_content_type, p_byte_size,
    auth.uid(), p_parent_type, p_parent_id, v_object_visibility, 'pending'
  ) returning id into v_file_id;

  return jsonb_build_object('fileId', v_file_id, 'objectKey', v_key);
end;
$$;

create or replace function public.phase4_confirm_upload(
  p_file_id uuid, p_verified_size bigint, p_verified_content_type text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_file public.phase4_files%rowtype;
begin
  select * into v_file from public.phase4_files where id = p_file_id for update;
  if not found then raise exception 'File record not found'; end if;
  if v_file.uploader_id <> auth.uid() and not public.phase4_is_admin() then
    raise exception 'You cannot confirm this upload.';
  end if;
  if p_verified_size is null or p_verified_size <= 0 or p_verified_size > v_file.byte_size then
    raise exception 'Uploaded object size does not match the authorised upload.';
  end if;
  update public.phase4_files
  set upload_status = 'confirmed',
      content_type = coalesce(p_verified_content_type, content_type),
      byte_size = p_verified_size, updated_at = now()
  where id = p_file_id;
  return jsonb_build_object('fileId', p_file_id, 'status', 'confirmed');
end;
$$;

create or replace function public.phase4_authorize_download(p_file_id uuid)
returns table (
  object_key text, content_type text, original_filename text, byte_size bigint
) language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.phase4_files f
    where f.id = p_file_id and f.upload_status = 'confirmed'
      and (public.phase4_can_view_file(f.id) or f.uploader_id = auth.uid())
  ) then raise exception 'File not available'; end if;

  return query
    select f.object_key, f.content_type, f.original_filename, f.byte_size
    from public.phase4_files f where f.id = p_file_id;
end;
$$;

revoke all on function public.phase4_authorize_upload(text, uuid, text, text, bigint, text) from public;
revoke all on function public.phase4_confirm_upload(uuid, bigint, text) from public;
revoke all on function public.phase4_authorize_download(uuid) from public;
grant execute on function public.phase4_authorize_upload(text, uuid, text, text, bigint, text) to authenticated;
grant execute on function public.phase4_confirm_upload(uuid, bigint, text) to authenticated;
grant execute on function public.phase4_authorize_download(uuid) to authenticated, anon;

comment on table public.sports_events is 'Phase 4 event container; RLS scoped to PE Admin, assigned organisers and public visibility.';
comment on table public.tournament_draws is 'Authoritative tournament generation version; the React Flow canvas is a projection of this data.';
comment on table public.competition_payment_records is 'Private payment proofs; never exposed to organisers or public pages.';






