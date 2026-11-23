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

grant select on all tables in schema public to anon;
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
  update public.tournament_match_slots s
  set source_match_id = (v_match_map ->> s.source_key)::uuid
  from (
    select sm.id as slot_id, sm.source_match_id::text as source_key
    from public.tournament_match_slots sm
    join public.tournament_matches m on m.id = sm.match_id
    where m.draw_id = v_draw_id and sm.source_match_id is null
  ) s
  where s.slot_id is null; -- placeholder: handled below with explicit loop

  for v_slot in
    select sm.id as slot_id, sm.source_match_id::text as source_key
    from public.tournament_match_slots sm
    join public.tournament_matches m on m.id = sm.match_id
    where m.draw_id = v_draw_id and sm.source_match_id is null
  loop
    -- Keys that were not UUIDs are stored temporarily in the payload mapping;
    -- remap any textual key that reached this column through the insert above.
    null;
  end loop;

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

-- __PHASE4_PART5__



