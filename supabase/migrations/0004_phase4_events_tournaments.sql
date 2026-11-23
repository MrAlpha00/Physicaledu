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

-- __PHASE4_PART3__

