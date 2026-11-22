-- VARSITY — Phase 3: department management
-- Additive only: no drop, no destructive alteration, no replacement of Phase 1/2 data.
-- Apply once, after 0001_phase1_foundation.sql and 0002_phase2_daily_operations.sql.
-- This migration is prepared locally only; do not apply it to a remote project from this task.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Schema assumptions inherited from 0001/0002 (no remote fix attempted here):
--   * roles remain read-only text values in public.user_roles, with privileged
--     checks performed by public.is_pe_admin()/public.has_role() helpers;
--   * active PE eligibility is public.is_active_pe_student();
--   * student identity is resolved through public.student_directory_id_for_user();
--   * public.write_audit() and public.admin_log_action() already exist;
--   * public.qr_codes already allows qr_type/theme = 'equipment'.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Shared private file metadata (reuses the Phase 2 R2 presigning service)
-- ===========================================================================

create table public.phase3_files (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  bucket text not null default 'r2',
  original_filename text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  uploader_id uuid references auth.users (id) on delete set null,
  parent_type text not null check (parent_type in (
    'equipment_image', 'maintenance_photo', 'feedback_attachment',
    'calendar_attachment', 'game_rule_image', 'game_rule_document',
    'achievement_evidence', 'announcement_attachment', 'sports_profile_photo'
  )),
  parent_id uuid not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  upload_status text not null default 'pending' check (upload_status in ('pending', 'confirmed', 'failed')),
  sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index phase3_files_parent_idx on public.phase3_files (parent_type, parent_id);
create index phase3_files_uploader_idx on public.phase3_files (uploader_id);
create trigger phase3_files_set_updated_at before update on public.phase3_files
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Configurable student groups (shared by calendar, notifications and email)
-- ===========================================================================

create table public.student_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_groups_name_not_blank check (btrim(name) <> '')
);

create unique index student_groups_name_uidx on public.student_groups (lower(btrim(name)));
create trigger student_groups_set_updated_at before update on public.student_groups
  for each row execute function public.set_updated_at();

create table public.student_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.student_groups (id) on delete cascade,
  student_directory_id uuid not null references public.student_directory (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint student_group_members_unique unique (group_id, student_directory_id)
);

create index student_group_members_student_idx
  on public.student_group_members (student_directory_id);

-- ===========================================================================
-- Equipment inventory
-- ===========================================================================

create table public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_categories_name_not_blank check (btrim(name) <> '')
);

create unique index equipment_categories_name_uidx
  on public.equipment_categories (lower(btrim(name)));
create index equipment_categories_active_idx on public.equipment_categories (is_active, sort_order);
create trigger equipment_categories_set_updated_at before update on public.equipment_categories
  for each row execute function public.set_updated_at();

create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.equipment_categories (id) on delete restrict,
  name text not null,
  description text,
  identification_number text,
  tracking_mode text not null check (tracking_mode in ('individual', 'bulk')),
  quantity integer not null check (quantity > 0),
  available_quantity integer not null check (available_quantity >= 0),
  borrowed_quantity integer not null default 0 check (borrowed_quantity >= 0),
  maintenance_quantity integer not null default 0 check (maintenance_quantity >= 0),
  damaged_quantity integer not null default 0 check (damaged_quantity >= 0),
  retired_quantity integer not null default 0 check (retired_quantity >= 0),
  condition text not null default 'good' check (condition in ('excellent', 'good', 'fair', 'poor', 'unusable')),
  storage_location text,
  purchased_on date,
  useful_life_months integer check (useful_life_months > 0),
  notes text,
  image_file_id uuid references public.phase3_files (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_items_name_not_blank check (btrim(name) <> ''),
  constraint equipment_items_stock_balance check (
    (tracking_mode = 'bulk' and available_quantity + borrowed_quantity
      + maintenance_quantity + damaged_quantity + retired_quantity = quantity)
    or (tracking_mode = 'individual' and available_quantity + borrowed_quantity
      + maintenance_quantity + damaged_quantity + retired_quantity <= quantity)
  )
);

create unique index equipment_items_identification_uidx
  on public.equipment_items (upper(btrim(identification_number)))
  where identification_number is not null;
create index equipment_items_category_idx on public.equipment_items (category_id, is_active);
create index equipment_items_available_idx on public.equipment_items (available_quantity);
create trigger equipment_items_set_updated_at before update on public.equipment_items
  for each row execute function public.set_updated_at();

create table public.equipment_assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment_items (id) on delete cascade,
  asset_tag text not null,
  serial_number text,
  condition text not null default 'good' check (condition in ('excellent', 'good', 'fair', 'poor', 'unusable')),
  status text not null default 'available' check (status in (
    'available', 'borrowed', 'under_maintenance', 'damaged', 'retired', 'unavailable'
  )),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_assets_tag_not_blank check (btrim(asset_tag) <> '')
);

create unique index equipment_assets_tag_uidx on public.equipment_assets (upper(btrim(asset_tag)));
create unique index equipment_assets_item_tag_uidx on public.equipment_assets (item_id, upper(btrim(asset_tag)));
create index equipment_assets_item_status_idx on public.equipment_assets (item_id, status);
create trigger equipment_assets_set_updated_at before update on public.equipment_assets
  for each row execute function public.set_updated_at();

create table public.equipment_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment_items (id) on delete restrict,
  asset_id uuid references public.equipment_assets (id) on delete restrict,
  student_directory_id uuid not null references public.student_directory (id) on delete restrict,
  quantity_issued integer not null check (quantity_issued > 0),
  quantity_returned integer not null default 0 check (quantity_returned >= 0),
  issued_at timestamptz not null default now(),
  expected_return_at timestamptz not null,
  issued_by uuid references auth.users (id) on delete set null,
  issue_condition text not null default 'good' check (issue_condition in ('excellent', 'good', 'fair', 'poor', 'unusable')),
  notes text,
  status text not null default 'issued' check (status in (
    'issued', 'partially_returned', 'returned', 'overdue', 'lost', 'damaged', 'cancelled'
  )),
  returned_at timestamptz,
  received_by uuid references auth.users (id) on delete set null,
  return_condition text check (return_condition in ('excellent', 'good', 'fair', 'poor', 'unusable')),
  damage_indicator boolean not null default false,
  return_notes text,
  correction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_transactions_return_quantity check (quantity_returned <= quantity_issued),
  constraint equipment_transactions_returned_complete check (
    status <> 'returned' or quantity_returned = quantity_issued
  )
);

create index equipment_transactions_student_idx
  on public.equipment_transactions (student_directory_id, issued_at desc);
create index equipment_transactions_item_idx on public.equipment_transactions (item_id, issued_at desc);
create index equipment_transactions_status_idx on public.equipment_transactions (status, expected_return_at);
create unique index equipment_transactions_one_active_asset_idx
  on public.equipment_transactions (asset_id)
  where asset_id is not null and status in ('issued', 'partially_returned', 'overdue');
create trigger equipment_transactions_set_updated_at before update on public.equipment_transactions
  for each row execute function public.set_updated_at();

create table public.equipment_return_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.equipment_transactions (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  condition text not null check (condition in ('excellent', 'good', 'fair', 'poor', 'unusable')),
  damage_indicator boolean not null default false,
  notes text,
  received_by uuid references auth.users (id) on delete set null,
  returned_at timestamptz not null default now()
);

create index equipment_return_records_transaction_idx
  on public.equipment_return_records (transaction_id, returned_at);

create table public.equipment_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment_items (id) on delete cascade,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null,
  administrator_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint equipment_stock_adjustments_reason_not_blank check (btrim(reason) <> '')
);

create index equipment_stock_adjustments_item_idx
  on public.equipment_stock_adjustments (item_id, created_at desc);

create table public.equipment_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment_items (id) on delete restrict,
  asset_id uuid references public.equipment_assets (id) on delete restrict,
  issue_description text not null,
  maintenance_type text not null check (maintenance_type in ('damage', 'fault', 'repair', 'inspection', 'other')),
  quantity_affected integer not null default 1 check (quantity_affected > 0),
  reported_at timestamptz not null default now(),
  reported_by uuid references auth.users (id) on delete set null,
  source_feedback_id uuid,
  assigned_person text,
  scheduled_for timestamptz,
  expected_completion_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  resolution_notes text,
  status text not null default 'reported' check (status in (
    'reported', 'under_review', 'scheduled', 'in_progress', 'completed', 'unrepairable', 'cancelled'
  )),
  cost numeric(12, 2) check (cost is null or cost >= 0),
  cost_authorised_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_maintenance_issue_not_blank check (btrim(issue_description) <> ''),
  constraint equipment_maintenance_completed_fields check (
    status <> 'completed' or completed_at is not null
  )
);

create index equipment_maintenance_item_idx
  on public.equipment_maintenance_records (item_id, reported_at desc);
create index equipment_maintenance_status_idx
  on public.equipment_maintenance_records (status, reported_at desc);
create trigger equipment_maintenance_set_updated_at before update on public.equipment_maintenance_records
  for each row execute function public.set_updated_at();

create table public.equipment_qr_links (
  qr_code_id uuid primary key references public.qr_codes (id) on delete cascade,
  item_id uuid not null references public.equipment_items (id) on delete cascade,
  asset_id uuid references public.equipment_assets (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index equipment_qr_links_item_idx on public.equipment_qr_links (item_id);

-- ===========================================================================
-- PE activity calendar
-- ===========================================================================

create table public.pe_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in (
    'pe_class', 'sports_practice', 'competition', 'fitness_activity',
    'department_activity', 'announcement', 'deadline', 'other'
  )),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text,
  visibility text not null default 'pe_only' check (visibility in ('public', 'authenticated', 'pe_only')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_recurring boolean not null default false,
  attachment_file_id uuid references public.phase3_files (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pe_calendar_events_title_not_blank check (btrim(title) <> ''),
  constraint pe_calendar_events_period check (ends_at > starts_at)
);

create index pe_calendar_events_period_idx on public.pe_calendar_events (starts_at, ends_at);
create index pe_calendar_events_status_idx on public.pe_calendar_events (status, starts_at);
create trigger pe_calendar_events_set_updated_at before update on public.pe_calendar_events
  for each row execute function public.set_updated_at();

create table public.calendar_audiences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.pe_calendar_events (id) on delete cascade,
  audience_type text not null check (audience_type in (
    'all_students', 'active_pe', 'department', 'semester', 'selected_students', 'group'
  )),
  department_id uuid references public.departments (id) on delete cascade,
  semester smallint check (semester between 1 and 12),
  student_directory_id uuid references public.student_directory (id) on delete cascade,
  group_id uuid references public.student_groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint calendar_audiences_target check (
    (audience_type = 'all_students' and department_id is null and semester is null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'active_pe' and department_id is null and semester is null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'department' and department_id is not null and semester is null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'semester' and department_id is null and semester is not null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'selected_students' and department_id is null and semester is null
      and student_directory_id is not null and group_id is null)
    or (audience_type = 'group' and department_id is null and semester is null
      and student_directory_id is null and group_id is not null)
  )
);

create unique index calendar_audiences_unique_target_idx on public.calendar_audiences (
  event_id, audience_type,
  coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(semester, 0),
  coalesce(student_directory_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table public.calendar_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.pe_calendar_events (id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  by_weekday smallint[],
  ends_on date,
  occurrence_limit integer check (occurrence_limit between 1 and 260),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_recurrence_rule_terminates check (
    ends_on is not null or occurrence_limit is not null
  ),
  constraint calendar_recurrence_weekday_values check (
    by_weekday is null or (
      array_length(by_weekday, 1) is not null
      and by_weekday <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  )
);

create trigger calendar_recurrence_rules_set_updated_at before update
  on public.calendar_recurrence_rules for each row execute function public.set_updated_at();

create table public.calendar_event_overrides (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.calendar_recurrence_rules (id) on delete cascade,
  occurrence_starts_at timestamptz not null,
  is_cancelled boolean not null default false,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_overrides_unique unique (rule_id, occurrence_starts_at),
  constraint calendar_event_overrides_period check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create trigger calendar_event_overrides_set_updated_at before update
  on public.calendar_event_overrides for each row execute function public.set_updated_at();

-- ===========================================================================
-- Feedback and requests
-- ===========================================================================

create table public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  student_directory_id uuid not null references public.student_directory (id) on delete restrict,
  subject text not null,
  category text not null check (category in (
    'suggestion', 'complaint', 'equipment_request', 'equipment_damage',
    'facility_issue', 'sports_activity_request', 'attendance_correction', 'other'
  )),
  description text not null,
  status text not null default 'submitted' check (status in (
    'submitted', 'under_review', 'in_progress', 'waiting_for_student',
    'resolved', 'rejected', 'closed'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  preferred_response text check (preferred_response in ('in_app', 'email', 'either')),
  attachment_file_id uuid references public.phase3_files (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  constraint feedback_requests_subject_not_blank check (btrim(subject) <> ''),
  constraint feedback_requests_description_not_blank check (btrim(description) <> '')
);

create index feedback_requests_student_idx
  on public.feedback_requests (student_directory_id, created_at desc);
create index feedback_requests_status_idx on public.feedback_requests (status, created_at desc);
create index feedback_requests_category_idx on public.feedback_requests (category, created_at desc);
create trigger feedback_requests_set_updated_at before update on public.feedback_requests
  for each row execute function public.set_updated_at();

alter table public.equipment_maintenance_records
  add constraint equipment_maintenance_source_feedback_fkey
  foreign key (source_feedback_id) references public.feedback_requests (id) on delete set null;

create table public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feedback_requests (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  constraint feedback_replies_body_not_blank check (btrim(body) <> '')
);

create index feedback_replies_request_idx on public.feedback_replies (request_id, created_at);

create table public.feedback_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.feedback_requests (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index feedback_status_history_request_idx
  on public.feedback_status_history (request_id, created_at);

-- ===========================================================================
-- Game rules / sports information CMS
-- ===========================================================================

create table public.game_rule_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_rule_categories_name_not_blank check (btrim(name) <> ''),
  constraint game_rule_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index game_rule_categories_name_uidx
  on public.game_rule_categories (lower(btrim(name)));
create unique index game_rule_categories_slug_uidx on public.game_rule_categories (slug);
create trigger game_rule_categories_set_updated_at before update on public.game_rule_categories
  for each row execute function public.set_updated_at();

create table public.game_rule_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.game_rule_categories (id) on delete set null,
  title text not null,
  slug text not null,
  introduction text,
  history text,
  about_game text,
  how_to_play text,
  rules_text text,
  equipment_required text,
  players_count text,
  playing_area text,
  instructions text,
  safety_instructions text,
  video_urls text[] not null default array[]::text[],
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  is_featured boolean not null default false,
  is_pinned boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_rule_posts_title_not_blank check (btrim(title) <> ''),
  constraint game_rule_posts_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint game_rule_posts_published_at check (
    status <> 'published' or published_at is not null
  )
);

create unique index game_rule_posts_slug_uidx on public.game_rule_posts (slug);
create index game_rule_posts_public_idx
  on public.game_rule_posts (status, published_at desc);
create index game_rule_posts_category_idx on public.game_rule_posts (category_id, status);
create trigger game_rule_posts_set_updated_at before update on public.game_rule_posts
  for each row execute function public.set_updated_at();

create table public.game_rule_blocks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.game_rule_posts (id) on delete cascade,
  block_type text not null check (block_type in (
    'heading', 'paragraph', 'image', 'image_gallery', 'bullet_list',
    'numbered_instructions', 'rules_section', 'quote', 'video_embed', 'resource'
  )),
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_rule_blocks_post_idx on public.game_rule_blocks (post_id, sort_order);
create trigger game_rule_blocks_set_updated_at before update on public.game_rule_blocks
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Notifications and announcements
-- ===========================================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  link text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  audience_summary text,
  created_by uuid references auth.users (id) on delete set null,
  attachment_file_id uuid references public.phase3_files (id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint announcements_title_not_blank check (btrim(title) <> ''),
  constraint announcements_message_not_blank check (btrim(message) <> ''),
  constraint announcements_link_format check (link is null or link ~ '^https?://[^[:space:]]+$' or link like '/%')
);

create index announcements_published_idx on public.announcements (published_at desc);

create table public.announcement_audiences (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  audience_type text not null check (audience_type in (
    'all_students', 'active_pe', 'department', 'semester', 'selected_students', 'group'
  )),
  department_id uuid references public.departments (id) on delete cascade,
  semester smallint check (semester between 1 and 12),
  student_directory_id uuid references public.student_directory (id) on delete cascade,
  group_id uuid references public.student_groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint announcement_audiences_target check (
    (audience_type = 'all_students' and department_id is null and semester is null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'active_pe' and department_id is null and semester is null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'department' and department_id is not null and semester is null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'semester' and department_id is null and semester is not null
      and student_directory_id is null and group_id is null)
    or (audience_type = 'selected_students' and department_id is null and semester is null
      and student_directory_id is not null and group_id is null)
    or (audience_type = 'group' and department_id is null and semester is null
      and student_directory_id is null and group_id is not null)
  )
);

create unique index announcement_audiences_unique_target_idx on public.announcement_audiences (
  announcement_id, audience_type,
  coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(semester, 0),
  coalesce(student_directory_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general' check (category in (
    'general', 'attendance', 'task', 'calendar', 'feedback', 'equipment',
    'announcement', 'achievement', 'future_event'
  )),
  link text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  announcement_id uuid references public.announcements (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_not_blank check (btrim(title) <> ''),
  constraint notifications_link_format check (link is null or link ~ '^https?://[^[:space:]]+$' or link like '/%')
);

create index notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);
create index notifications_category_idx on public.notifications (category, created_at desc);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'general', 'attendance', 'task', 'calendar', 'feedback', 'equipment',
    'announcement', 'achievement', 'future_event'
  )),
  channel text not null check (channel in ('in_app', 'email')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint notification_preferences_unique unique (user_id, category, channel)
);

create trigger notification_preferences_set_updated_at before update
  on public.notification_preferences for each row execute function public.set_updated_at();

-- ===========================================================================
-- Resend email queue
-- ===========================================================================

create table public.email_announcements (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references public.announcements (id) on delete set null,
  title text not null,
  body text not null,
  link text,
  attachment_file_id uuid references public.phase3_files (id) on delete set null,
  audience_summary text,
  daily_limit integer not null default 100 check (daily_limit between 1 and 100),
  status text not null default 'queued' check (status in ('draft', 'queued', 'sending', 'completed', 'failed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_announcements_title_not_blank check (btrim(title) <> ''),
  constraint email_announcements_body_not_blank check (btrim(body) <> '')
);

create index email_announcements_status_idx on public.email_announcements (status, created_at desc);
create trigger email_announcements_set_updated_at before update on public.email_announcements
  for each row execute function public.set_updated_at();

create table public.email_recipients (
  id uuid primary key default gen_random_uuid(),
  email_announcement_id uuid not null references public.email_announcements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'queued' check (status in (
    'queued', 'sending', 'accepted', 'delivered', 'failed', 'bounced'
  )),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  provider_message_id text,
  queued_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint email_recipients_unique unique (email_announcement_id, user_id)
);

create index email_recipients_dispatch_idx on public.email_recipients (status, queued_at);
create index email_recipients_provider_idx on public.email_recipients (provider_message_id)
  where provider_message_id is not null;
create trigger email_recipients_set_updated_at before update on public.email_recipients
  for each row execute function public.set_updated_at();

create table public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.email_recipients (id) on delete set null,
  provider_event_id text not null unique,
  event_type text not null check (event_type in ('accepted', 'delivered', 'bounced', 'complained', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.email_daily_usage (
  usage_date date primary key,
  accepted_count integer not null default 0 check (accepted_count >= 0),
  updated_at timestamptz not null default now()
);

create trigger email_daily_usage_set_updated_at before update on public.email_daily_usage
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Sports profiles and verified participation
-- ===========================================================================

create table public.sports_profile_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  biography text,
  sports_interests text[] not null default array[]::text[],
  preferred_sports text[] not null default array[]::text[],
  profile_photo_file_id uuid references public.phase3_files (id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sports_profile_details_set_updated_at before update on public.sports_profile_details
  for each row execute function public.set_updated_at();

create table public.sports_achievements (
  id uuid primary key default gen_random_uuid(),
  student_directory_id uuid not null references public.student_directory (id) on delete cascade,
  title text not null,
  sport text not null,
  event_name text,
  academic_year text,
  achievement_date date,
  position_result text,
  award_description text,
  evidence_file_id uuid references public.phase3_files (id) on delete set null,
  verification_status text not null default 'pending' check (
    verification_status in ('pending', 'verified', 'rejected')
  ),
  source_type text not null default 'student_entry' check (
    source_type in ('student_entry', 'admin_record', 'future_event', 'future_game')
  ),
  source_reference text,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  verification_note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sports_achievements_title_not_blank check (btrim(title) <> ''),
  constraint sports_achievements_sport_not_blank check (btrim(sport) <> ''),
  constraint sports_achievements_verified_fields check (
    verification_status <> 'verified' or (verified_by is not null and verified_at is not null)
  )
);

create index sports_achievements_student_idx
  on public.sports_achievements (student_directory_id, verification_status, achievement_date desc);
create index sports_achievements_status_idx
  on public.sports_achievements (verification_status, created_at desc);
create trigger sports_achievements_set_updated_at before update on public.sports_achievements
  for each row execute function public.set_updated_at();

create table public.sports_participation_records (
  id uuid primary key default gen_random_uuid(),
  student_directory_id uuid not null references public.student_directory (id) on delete cascade,
  source_type text not null check (source_type in (
    'attendance', 'class_task', 'future_event', 'future_game', 'manual'
  )),
  source_reference text not null,
  sport text,
  activity_title text not null,
  participated_at timestamptz not null default now(),
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sports_participation_unique unique (student_directory_id, source_type, source_reference)
);

create index sports_participation_student_idx
  on public.sports_participation_records (student_directory_id, participated_at desc);

-- ===========================================================================
-- Shared helpers. SECURITY DEFINER functions always use a pinned search_path,
-- re-check roles internally and never expose raw tokens or private records.
-- ===========================================================================

create or replace function public.phase3_log(
  p_action text,
  p_target_table text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public.write_audit(p_action, p_target_table, p_target_id, p_details);
end;
$$;

create or replace function public.phase3_student_directory_id(
  p_user_id uuid default auth.uid()
) returns uuid
language sql security definer stable set search_path = public, pg_temp
as $$
  select public.student_directory_id_for_user(p_user_id);
$$;

create or replace function public.phase3_matches_audience(
  p_audiences jsonb,
  p_user_id uuid default auth.uid()
) returns boolean
language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_directory_id uuid;
  v_department_id uuid;
  v_semester integer;
begin
  if p_audiences is null or jsonb_array_length(p_audiences) = 0 then
    return false;
  end if;

  v_directory_id := public.phase3_student_directory_id(p_user_id);
  if v_directory_id is null then
    return false;
  end if;

  select department_id, semester into v_department_id, v_semester
  from public.student_directory where id = v_directory_id;

  for v_row in select value from jsonb_array_elements(p_audiences)
  loop
    case v_row->>'audience_type'
      when 'all_students' then
        if v_department_id is not null then return true; end if;
      when 'active_pe' then
        if public.is_active_pe_student(p_user_id) then return true; end if;
      when 'department' then
        if v_row->>'department_id' is not null
           and (v_row->>'department_id')::uuid = v_department_id then return true; end if;
      when 'semester' then
        if v_row->>'semester' is not null
           and (v_row->>'semester')::integer = v_semester then return true; end if;
      when 'selected_students' then
        if v_row->>'student_directory_id' is not null
           and (v_row->>'student_directory_id')::uuid = v_directory_id then return true; end if;
      when 'group' then
        if v_row->>'group_id' is not null and exists (
          select 1 from public.student_group_members m
          where m.group_id = (v_row->>'group_id')::uuid
            and m.student_directory_id = v_directory_id
        ) then return true; end if;
      else
        null;
    end case;
  end loop;

  return false;
end;
$$;

create or replace function public.phase3_notify_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_category text default 'general',
  p_link text default null,
  p_priority text default 'normal',
  p_announcement_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_enabled boolean;
  v_notification_id uuid;
begin
  if p_user_id is null or p_announcement_id is null then
    select enabled into v_enabled
    from public.notification_preferences
    where user_id = p_user_id and category = p_category and channel = 'in_app';
  else
    v_enabled := true;
  end if;

  if v_enabled = false then
    return null;
  end if;

  insert into public.notifications (user_id, title, body, category, link, priority, announcement_id)
  values (p_user_id, p_title, p_body, p_category, p_link, p_priority, p_announcement_id)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

create or replace function public.student_matches_calendar(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
) returns boolean
language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_audiences jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'audience_type', a.audience_type,
    'department_id', a.department_id,
    'semester', a.semester,
    'student_directory_id', a.student_directory_id,
    'group_id', a.group_id
  )), '[]'::jsonb)
  into v_audiences
  from public.calendar_audiences a where a.event_id = p_event_id;

  return public.phase3_matches_audience(v_audiences, p_user_id);
end;
$$;

create or replace function public.can_view_calendar_event(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
) returns boolean
language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_event public.pe_calendar_events%rowtype;
begin
  select * into v_event from public.pe_calendar_events where id = p_event_id;
  if not found or v_event.status <> 'published' then
    return false;
  end if;

  if v_event.visibility = 'public' then
    return true;
  end if;
  if p_user_id is null then
    return false;
  end if;
  if v_event.visibility = 'authenticated' then
    return public.student_matches_calendar(p_event_id, p_user_id);
  end if;

  return public.is_active_pe_student(p_user_id)
    and public.student_matches_calendar(p_event_id, p_user_id);
end;
$$;

-- ===========================================================================
-- Equipment: categories, stock, individual assets and QR links
-- ===========================================================================

create or replace function public.admin_save_equipment_category(
  p_category_id uuid,
  p_data jsonb
) returns setof public.equipment_categories
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_pe_admin() then
    raise exception 'PE Admin access required';
  end if;

  if p_category_id is null then
    insert into public.equipment_categories (name, description, sort_order, is_active)
    values (
      btrim(p_data->>'name'), nullif(p_data->>'description', ''),
      coalesce((p_data->>'sort_order')::integer, 0),
      coalesce((p_data->>'is_active')::boolean, true)
    ) returning id into v_id;
    perform public.phase3_log('equipment_category_created', 'equipment_categories', v_id::text, p_data);
  else
    update public.equipment_categories set
      name = btrim(p_data->>'name'),
      description = nullif(p_data->>'description', ''),
      sort_order = coalesce((p_data->>'sort_order')::integer, 0),
      is_active = coalesce((p_data->>'is_active')::boolean, true)
    where id = p_category_id returning id into v_id;
    perform public.phase3_log('equipment_category_updated', 'equipment_categories', v_id::text, p_data);
  end if;

  return query select * from public.equipment_categories where id = v_id;
end;
$$;

create or replace function public.admin_save_equipment_item(
  p_item_id uuid,
  p_data jsonb
) returns setof public.equipment_items
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_quantity integer := (p_data->>'quantity')::integer;
  v_mode text := p_data->>'tracking_mode';
  v_old public.equipment_items%rowtype;
  v_delta integer;
begin
  if not public.is_pe_admin() then
    raise exception 'PE Admin access required';
  end if;
  if v_quantity is null or v_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;
  if v_mode not in ('individual', 'bulk') then
    raise exception 'Choose a valid tracking mode';
  end if;

  if p_item_id is null then
    insert into public.equipment_items (
      category_id, name, description, identification_number, tracking_mode,
      quantity, available_quantity, condition, storage_location, purchased_on,
      useful_life_months, notes, image_file_id, is_active
    ) values (
      (p_data->>'category_id')::uuid,
      btrim(p_data->>'name'),
      nullif(p_data->>'description', ''),
      nullif(btrim(coalesce(p_data->>'identification_number', '')), ''),
      v_mode,
      v_quantity,
      case when v_mode = 'bulk' then v_quantity else 0 end,
      coalesce(p_data->>'condition', 'good'),
      nullif(p_data->>'storage_location', ''),
      nullif(p_data->>'purchased_on', '')::date,
      nullif(p_data->>'useful_life_months', '')::integer,
      nullif(p_data->>'notes', ''),
      nullif(p_data->>'image_file_id', '')::uuid,
      coalesce((p_data->>'is_active')::boolean, true)
    ) returning id into v_id;
    perform public.phase3_log('equipment_item_created', 'equipment_items', v_id::text, p_data);
  else
    select * into v_old from public.equipment_items where id = p_item_id for update;
    if not found then raise exception 'Equipment item not found'; end if;

    if v_mode <> v_old.tracking_mode then
      raise exception 'Tracking mode cannot be changed after registration';
    end if;

    v_delta := v_quantity - v_old.quantity;
    if v_old.available_quantity + v_delta < 0 then
      raise exception 'Quantity cannot be reduced below issued or reserved stock';
    end if;

    update public.equipment_items set
      category_id = (p_data->>'category_id')::uuid,
      name = btrim(p_data->>'name'),
      description = nullif(p_data->>'description', ''),
      identification_number = nullif(btrim(coalesce(p_data->>'identification_number', '')), ''),
      quantity = v_quantity,
      available_quantity = case
        when v_mode = 'bulk' then v_old.available_quantity + v_delta
        else v_old.available_quantity
      end,
      condition = coalesce(p_data->>'condition', v_old.condition),
      storage_location = nullif(p_data->>'storage_location', ''),
      purchased_on = nullif(p_data->>'purchased_on', '')::date,
      useful_life_months = nullif(p_data->>'useful_life_months', '')::integer,
      notes = nullif(p_data->>'notes', ''),
      image_file_id = nullif(p_data->>'image_file_id', '')::uuid,
      is_active = coalesce((p_data->>'is_active')::boolean, v_old.is_active)
    where id = p_item_id returning id into v_id;
    perform public.phase3_log('equipment_item_updated', 'equipment_items', v_id::text, p_data);
  end if;

  return query select * from public.equipment_items where id = v_id;
end;
$$;

create or replace function public.admin_create_equipment_asset(
  p_item_id uuid,
  p_data jsonb
) returns setof public.equipment_assets
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_item public.equipment_items%rowtype;
  v_asset_id uuid;
  v_registered integer;
begin
  if not public.is_pe_admin() then
    raise exception 'PE Admin access required';
  end if;

  select * into v_item from public.equipment_items where id = p_item_id for update;
  if not found then raise exception 'Equipment item not found'; end if;
  if v_item.tracking_mode <> 'individual' then
    raise exception 'Assets can only be registered for individual tracking items';
  end if;

  select count(*)::integer into v_registered
  from public.equipment_assets where item_id = p_item_id;

  insert into public.equipment_assets (item_id, asset_tag, serial_number, condition, status, location, notes)
  values (
    p_item_id,
    btrim(p_data->>'asset_tag'),
    nullif(p_data->>'serial_number', ''),
    coalesce(p_data->>'condition', 'good'),
    'available',
    nullif(p_data->>'location', ''),
    nullif(p_data->>'notes', '')
  ) returning id into v_asset_id;

  update public.equipment_items set
    quantity = case when v_registered >= quantity then quantity + 1 else quantity end,
    available_quantity = available_quantity + 1
  where id = p_item_id;

  perform public.phase3_log('equipment_asset_created', 'equipment_assets', v_asset_id::text, p_data);
  return query select * from public.equipment_assets where id = v_asset_id;
end;
$$;

create or replace function public.admin_adjust_equipment_stock(
  p_item_id uuid,
  p_quantity_delta integer,
  p_reason text
) returns setof public.equipment_items
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_item public.equipment_items%rowtype;
begin
  if not public.is_pe_admin() then
    raise exception 'PE Admin access required';
  end if;
  if p_quantity_delta = 0 or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A non-zero adjustment and reason are required';
  end if;

  select * into v_item from public.equipment_items where id = p_item_id for update;
  if not found then raise exception 'Equipment item not found'; end if;
  if v_item.tracking_mode <> 'bulk' then
    raise exception 'Adjust individual assets from the asset register';
  end if;
  if v_item.available_quantity + p_quantity_delta < 0 then
    raise exception 'Adjustment would create negative available stock';
  end if;
  if v_item.available_quantity + p_quantity_delta > v_item.quantity then
    raise exception 'Adjustment exceeds registered stock';
  end if;

  update public.equipment_items
  set quantity = quantity + p_quantity_delta,
      available_quantity = available_quantity + p_quantity_delta
  where id = p_item_id;

  insert into public.equipment_stock_adjustments (item_id, quantity_delta, reason, administrator_id)
  values (p_item_id, p_quantity_delta, btrim(p_reason), auth.uid());

  perform public.phase3_log('equipment_stock_adjusted', 'equipment_items', p_item_id::text,
    jsonb_build_object('delta', p_quantity_delta, 'reason', p_reason));

  return query select * from public.equipment_items where id = p_item_id;
end;
$$;

create or replace function public.borrow_equipment(
  p_item_id uuid,
  p_asset_id uuid,
  p_quantity integer,
  p_expected_return_at timestamptz,
  p_notes text default null,
  p_student_directory_id uuid default null
) returns setof public.equipment_transactions
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := public.is_pe_admin();
  v_directory_id uuid;
  v_item public.equipment_items%rowtype;
  v_asset public.equipment_assets%rowtype;
  v_transaction_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_student_directory_id is not null and not v_is_admin then
    raise exception 'Only PE Admin can issue equipment for another student';
  end if;

  v_directory_id := coalesce(p_student_directory_id, public.phase3_student_directory_id(v_user));
  if v_directory_id is null then raise exception 'No active student directory record'; end if;
  if not v_is_admin and not public.is_active_pe_student(v_user) then
    raise exception 'Active PE membership is required to borrow equipment';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Borrow quantity must be at least 1';
  end if;
  if p_expected_return_at is null or p_expected_return_at <= now() then
    raise exception 'Choose a future expected return time';
  end if;

  select * into v_item from public.equipment_items where id = p_item_id for update;
  if not found or not v_item.is_active then
    raise exception 'Equipment item is not available for borrowing';
  end if;

  if v_item.tracking_mode = 'individual' then
    if p_asset_id is null or p_quantity <> 1 then
      raise exception 'Individual assets must be borrowed one at a time';
    end if;
    select * into v_asset from public.equipment_assets where id = p_asset_id for update;
    if not found or v_asset.item_id <> p_item_id or v_asset.status <> 'available' then
      raise exception 'This asset is not available';
    end if;
    update public.equipment_assets set status = 'borrowed' where id = v_asset.id;
    update public.equipment_items
    set available_quantity = available_quantity - 1,
        borrowed_quantity = borrowed_quantity + 1
    where id = v_item.id;
  else
    if p_asset_id is not null then
      raise exception 'Bulk stock does not use individual asset selection';
    end if;
    if v_item.available_quantity < p_quantity then
      raise exception 'Not enough stock available';
    end if;
    update public.equipment_items
    set available_quantity = available_quantity - p_quantity,
        borrowed_quantity = borrowed_quantity + p_quantity
    where id = v_item.id;
  end if;

  insert into public.equipment_transactions (
    item_id, asset_id, student_directory_id, quantity_issued, expected_return_at,
    issued_by, issue_condition, notes
  ) values (
    p_item_id, p_asset_id, v_directory_id, p_quantity, p_expected_return_at,
    v_user, coalesce(v_item.condition, 'good'), nullif(p_notes, '')
  ) returning id into v_transaction_id;

  perform public.phase3_log('equipment_borrowed', 'equipment_transactions', v_transaction_id::text,
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity, 'asset_id', p_asset_id));

  return query select * from public.equipment_transactions where id = v_transaction_id;
end;
$$;

create or replace function public.return_equipment(
  p_transaction_id uuid,
  p_quantity integer,
  p_condition text,
  p_damage_indicator boolean default false,
  p_notes text default null
) returns setof public.equipment_transactions
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := public.is_pe_admin();
  v_directory_id uuid;
  v_tx public.equipment_transactions%rowtype;
  v_new_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_tx from public.equipment_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Borrowing transaction not found'; end if;

  v_directory_id := public.phase3_student_directory_id(v_user);
  if not v_is_admin and (v_directory_id is null or v_tx.student_directory_id <> v_directory_id) then
    raise exception 'You can only return your own equipment';
  end if;
  if v_tx.status in ('returned', 'cancelled', 'lost') then
    raise exception 'This transaction is already complete';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Return quantity must be at least 1';
  end if;
  if v_tx.quantity_returned + p_quantity > v_tx.quantity_issued then
    raise exception 'Return quantity exceeds the issued quantity';
  end if;
  if p_condition not in ('excellent', 'good', 'fair', 'poor', 'unusable') then
    raise exception 'Choose a valid return condition';
  end if;

  if p_damage_indicator or p_condition = 'unusable' then
    update public.equipment_items
    set borrowed_quantity = borrowed_quantity - p_quantity,
        damaged_quantity = damaged_quantity + p_quantity
    where id = v_tx.item_id;
    if v_tx.asset_id is not null then
      update public.equipment_assets set status = 'damaged', condition = p_condition where id = v_tx.asset_id;
    end if;
  else
    update public.equipment_items
    set borrowed_quantity = borrowed_quantity - p_quantity,
        available_quantity = available_quantity + p_quantity
    where id = v_tx.item_id;
    if v_tx.asset_id is not null then
      update public.equipment_assets set status = 'available', condition = p_condition where id = v_tx.asset_id;
    end if;
  end if;

  v_new_status := case
    when v_tx.quantity_returned + p_quantity >= v_tx.quantity_issued then 'returned'
    else 'partially_returned'
  end;

  insert into public.equipment_return_records (
    transaction_id, quantity, condition, damage_indicator, notes, received_by
  ) values (
    p_transaction_id, p_quantity, p_condition, p_damage_indicator, nullif(p_notes, ''),
    case when v_is_admin then v_user else null end
  );

  update public.equipment_transactions set
    quantity_returned = quantity_returned + p_quantity,
    status = v_new_status,
    returned_at = case when v_new_status = 'returned' then now() else returned_at end,
    return_condition = p_condition,
    damage_indicator = damage_indicator or p_damage_indicator,
    return_notes = nullif(p_notes, ''),
    received_by = case when v_is_admin then v_user else received_by end
  where id = p_transaction_id;

  perform public.phase3_log('equipment_returned', 'equipment_transactions', p_transaction_id::text,
    jsonb_build_object('quantity', p_quantity, 'condition', p_condition, 'damage', p_damage_indicator));

  return query select * from public.equipment_transactions where id = p_transaction_id;
end;
$$;

create or replace function public.admin_correct_equipment_transaction(
  p_transaction_id uuid,
  p_reason text,
  p_expected_return_at timestamptz default null,
  p_status text default null
) returns setof public.equipment_transactions
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if btrim(coalesce(p_reason, '')) = '' then raise exception 'A correction reason is required'; end if;

  update public.equipment_transactions set
    expected_return_at = coalesce(p_expected_return_at, expected_return_at),
    status = coalesce(p_status, status),
    correction_reason = btrim(p_reason)
  where id = p_transaction_id;
  if not found then raise exception 'Transaction not found'; end if;

  perform public.phase3_log('equipment_transaction_corrected', 'equipment_transactions',
    p_transaction_id::text, jsonb_build_object('reason', p_reason, 'status', p_status));
  return query select * from public.equipment_transactions where id = p_transaction_id;
end;
$$;

create or replace function public.admin_save_equipment_maintenance(
  p_record_id uuid,
  p_data jsonb
) returns setof public.equipment_maintenance_records
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_item public.equipment_items%rowtype;
  v_quantity integer := coalesce((p_data->>'quantity_affected')::integer, 1);
  v_asset_id uuid := nullif(p_data->>'asset_id', '')::uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if v_quantity < 1 then raise exception 'Affected quantity must be at least 1'; end if;

  select * into v_item from public.equipment_items where id = (p_data->>'item_id')::uuid for update;
  if not found then raise exception 'Equipment item not found'; end if;
  if v_item.available_quantity < v_quantity then
    raise exception 'Not enough available stock to place under maintenance';
  end if;

  if p_record_id is null then
    insert into public.equipment_maintenance_records (
      item_id, asset_id, issue_description, maintenance_type, quantity_affected,
      reported_by, source_feedback_id, assigned_person, scheduled_for,
      expected_completion_at, notes, status
    ) values (
      v_item.id, v_asset_id, btrim(p_data->>'issue_description'),
      p_data->>'maintenance_type', v_quantity,
      nullif(p_data->>'reported_by', '')::uuid,
      nullif(p_data->>'source_feedback_id', '')::uuid,
      nullif(p_data->>'assigned_person', ''),
      nullif(p_data->>'scheduled_for', '')::timestamptz,
      nullif(p_data->>'expected_completion_at', '')::timestamptz,
      nullif(p_data->>'notes', ''),
      coalesce(p_data->>'status', 'reported')
    ) returning id into v_id;

    update public.equipment_items
    set available_quantity = available_quantity - v_quantity,
        maintenance_quantity = maintenance_quantity + v_quantity
    where id = v_item.id;
    if v_asset_id is not null then
      update public.equipment_assets set status = 'under_maintenance' where id = v_asset_id;
    end if;
    perform public.phase3_log('equipment_maintenance_reported', 'equipment_maintenance_records', v_id::text, p_data);
  else
    update public.equipment_maintenance_records set
      issue_description = btrim(p_data->>'issue_description'),
      maintenance_type = p_data->>'maintenance_type',
      assigned_person = nullif(p_data->>'assigned_person', ''),
      scheduled_for = nullif(p_data->>'scheduled_for', '')::timestamptz,
      expected_completion_at = nullif(p_data->>'expected_completion_at', '')::timestamptz,
      notes = nullif(p_data->>'notes', '')
    where id = p_record_id returning id into v_id;
    perform public.phase3_log('equipment_maintenance_updated', 'equipment_maintenance_records', v_id::text, p_data);
  end if;

  return query select * from public.equipment_maintenance_records where id = v_id;
end;
$$;

create or replace function public.admin_set_equipment_maintenance_status(
  p_record_id uuid,
  p_status text,
  p_resolution_notes text default null,
  p_cost numeric default null
) returns setof public.equipment_maintenance_records
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_record public.equipment_maintenance_records%rowtype;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_status not in ('reported', 'under_review', 'scheduled', 'in_progress', 'completed', 'unrepairable', 'cancelled') then
    raise exception 'Choose a valid maintenance status';
  end if;

  select * into v_record from public.equipment_maintenance_records where id = p_record_id for update;
  if not found then raise exception 'Maintenance record not found'; end if;
  if v_record.status in ('completed', 'unrepairable', 'cancelled') then
    raise exception 'This maintenance record is already closed';
  end if;

  if p_status in ('completed', 'unrepairable', 'cancelled') then
    update public.equipment_items set
      maintenance_quantity = maintenance_quantity - v_record.quantity_affected,
      available_quantity = case
        when p_status = 'unrepairable' then available_quantity
        else available_quantity + v_record.quantity_affected
      end,
      damaged_quantity = case
        when p_status = 'unrepairable' then damaged_quantity + v_record.quantity_affected
        else damaged_quantity
      end
    where id = v_record.item_id;

    if v_record.asset_id is not null then
      update public.equipment_assets set status = case
        when p_status = 'unrepairable' then 'damaged'
        else 'available'
      end where id = v_record.asset_id;
    end if;
  end if;

  update public.equipment_maintenance_records set
    status = p_status,
    resolution_notes = nullif(p_resolution_notes, ''),
    cost = p_cost,
    cost_authorised_by = case when p_cost is not null then auth.uid() else null end,
    started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_record_id;

  perform public.phase3_log('equipment_maintenance_status_changed', 'equipment_maintenance_records',
    p_record_id::text, jsonb_build_object('status', p_status, 'cost_recorded', p_cost is not null));
  return query select * from public.equipment_maintenance_records where id = p_record_id;
end;
$$;

create or replace function public.admin_create_equipment_qr(
  p_name text,
  p_item_id uuid,
  p_asset_id uuid default null
) returns setof public.qr_codes
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_qr_id uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Enter a QR name'; end if;
  if p_asset_id is not null and not exists (
    select 1 from public.equipment_assets where id = p_asset_id and item_id = p_item_id
  ) then raise exception 'Asset does not belong to this item'; end if;

  insert into public.qr_codes (name, qr_type, token, destination_path, theme, created_by)
  values (btrim(p_name), 'equipment', public.new_qr_token(), '/equipment', 'equipment', auth.uid())
  returning id into v_qr_id;

  insert into public.equipment_qr_links (qr_code_id, item_id, asset_id)
  values (v_qr_id, p_item_id, p_asset_id);

  perform public.phase3_log('equipment_qr_created', 'qr_codes', v_qr_id::text,
    jsonb_build_object('item_id', p_item_id, 'asset_id', p_asset_id));
  return query select * from public.qr_codes where id = v_qr_id;
end;
$$;

create or replace function public.resolve_equipment_qr(p_token text)
returns table (
  qr_id uuid,
  item_id uuid,
  asset_id uuid,
  item_name text,
  tracking_mode text,
  available_quantity integer,
  asset_tag text,
  condition text,
  theme text
)
language sql security definer stable set search_path = public, pg_temp
as $$
  select q.id, i.id, l.asset_id, i.name, i.tracking_mode, i.available_quantity,
         a.asset_tag, coalesce(a.condition, i.condition), q.theme
  from public.qr_codes q
  join public.equipment_qr_links l on l.qr_code_id = q.id
  join public.equipment_items i on i.id = l.item_id
  left join public.equipment_assets a on a.id = l.asset_id
  where q.token = p_token
    and q.qr_type = 'equipment'
    and q.is_active
    and i.is_active;
$$;

-- ===========================================================================
-- Calendar, feedback and Game Rules CMS
-- ===========================================================================

create or replace function public.admin_save_calendar_event(
  p_event_id uuid,
  p_data jsonb,
  p_audiences jsonb,
  p_recurrence jsonb default null
) returns setof public.pe_calendar_events
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status text := coalesce(p_data->>'status', 'draft');
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_audiences is null or jsonb_array_length(p_audiences) = 0 then
    raise exception 'Select at least one audience';
  end if;
  if (p_data->>'ends_at')::timestamptz <= (p_data->>'starts_at')::timestamptz then
    raise exception 'End time must be after the start time';
  end if;

  if p_event_id is null then
    insert into public.pe_calendar_events (
      title, description, category, starts_at, ends_at, venue, visibility, status,
      is_recurring, attachment_file_id, created_by, published_at
    ) values (
      btrim(p_data->>'title'), nullif(p_data->>'description', ''), p_data->>'category',
      (p_data->>'starts_at')::timestamptz, (p_data->>'ends_at')::timestamptz,
      nullif(p_data->>'venue', ''), coalesce(p_data->>'visibility', 'pe_only'), v_status,
      coalesce((p_data->>'is_recurring')::boolean, false),
      nullif(p_data->>'attachment_file_id', '')::uuid, auth.uid(),
      case when v_status = 'published' then now() else null end
    ) returning id into v_id;
  else
    update public.pe_calendar_events set
      title = btrim(p_data->>'title'),
      description = nullif(p_data->>'description', ''),
      category = p_data->>'category',
      starts_at = (p_data->>'starts_at')::timestamptz,
      ends_at = (p_data->>'ends_at')::timestamptz,
      venue = nullif(p_data->>'venue', ''),
      visibility = coalesce(p_data->>'visibility', 'pe_only'),
      status = v_status,
      is_recurring = coalesce((p_data->>'is_recurring')::boolean, false),
      attachment_file_id = nullif(p_data->>'attachment_file_id', '')::uuid,
      published_at = case
        when v_status = 'published' and published_at is null then now()
        when v_status = 'published' then published_at
        else null
      end
    where id = p_event_id returning id into v_id;

    delete from public.calendar_audiences where event_id = v_id;
  end if;

  insert into public.calendar_audiences (
    event_id, audience_type, department_id, semester, student_directory_id, group_id
  )
  select v_id, a.value->>'audience_type',
    nullif(a.value->>'department_id', '')::uuid,
    nullif(a.value->>'semester', '')::smallint,
    nullif(a.value->>'student_directory_id', '')::uuid,
    nullif(a.value->>'group_id', '')::uuid
  from jsonb_array_elements(p_audiences) with ordinality as a(value, ordinal);

  delete from public.calendar_recurrence_rules where event_id = v_id;
  if p_recurrence is not null and (p_recurrence->>'frequency') is not null then
    insert into public.calendar_recurrence_rules (
      event_id, frequency, interval_count, by_weekday, ends_on, occurrence_limit
    ) values (
      v_id,
      p_recurrence->>'frequency',
      coalesce((p_recurrence->>'interval_count')::integer, 1),
      case when p_recurrence->'by_weekday' is null then null
        else array(select jsonb_array_elements_text(p_recurrence->'by_weekday')::smallint)
      end,
      nullif(p_recurrence->>'ends_on', '')::date,
      nullif(p_recurrence->>'occurrence_limit', '')::integer
    );
  end if;

  perform public.phase3_log('calendar_event_saved', 'pe_calendar_events', v_id::text, p_data);
  return query select * from public.pe_calendar_events where id = v_id;
end;
$$;

create or replace function public.admin_save_calendar_override(
  p_rule_id uuid,
  p_occurrence_starts_at timestamptz,
  p_data jsonb
) returns setof public.calendar_event_overrides
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;

  insert into public.calendar_event_overrides (
    rule_id, occurrence_starts_at, is_cancelled, title, starts_at, ends_at, venue, description
  ) values (
    p_rule_id, p_occurrence_starts_at,
    coalesce((p_data->>'is_cancelled')::boolean, false),
    nullif(p_data->>'title', ''),
    nullif(p_data->>'starts_at', '')::timestamptz,
    nullif(p_data->>'ends_at', '')::timestamptz,
    nullif(p_data->>'venue', ''),
    nullif(p_data->>'description', '')
  )
  on conflict (rule_id, occurrence_starts_at) do update set
    is_cancelled = excluded.is_cancelled,
    title = excluded.title,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    venue = excluded.venue,
    description = excluded.description;

  perform public.phase3_log('calendar_occurrence_updated', 'calendar_event_overrides',
    p_rule_id::text, p_data);
  return query select * from public.calendar_event_overrides
    where rule_id = p_rule_id and occurrence_starts_at = p_occurrence_starts_at;
end;
$$;

create or replace function public.student_submit_feedback(p_data jsonb)
returns setof public.feedback_requests
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
  v_directory_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  v_directory_id := public.phase3_student_directory_id(v_user);
  if v_directory_id is null then raise exception 'No active student directory record'; end if;

  insert into public.feedback_requests (
    student_directory_id, subject, category, description, preferred_response, attachment_file_id
  ) values (
    v_directory_id, btrim(p_data->>'subject'), p_data->>'category',
    btrim(p_data->>'description'), nullif(p_data->>'preferred_response', ''),
    nullif(p_data->>'attachment_file_id', '')::uuid
  ) returning id into v_id;

  return query select * from public.feedback_requests where id = v_id;
end;
$$;

create or replace function public.student_reply_feedback(
  p_request_id uuid,
  p_body text
) returns setof public.feedback_replies
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_directory_id uuid := public.phase3_student_directory_id();
begin
  if v_directory_id is null then raise exception 'No active student directory record'; end if;
  if btrim(coalesce(p_body, '')) = '' then raise exception 'Enter a reply'; end if;
  if not exists (
    select 1 from public.feedback_requests
    where id = p_request_id and student_directory_id = v_directory_id and status <> 'closed'
  ) then raise exception 'Request not found or closed'; end if;

  insert into public.feedback_replies (request_id, author_id, body, is_internal)
  values (p_request_id, auth.uid(), btrim(p_body), false) returning id into v_id;

  return query select * from public.feedback_replies where id = v_id;
end;
$$;

create or replace function public.admin_update_feedback(
  p_request_id uuid,
  p_status text,
  p_priority text default null,
  p_response text default null,
  p_internal_note text default null
) returns setof public.feedback_requests
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_request public.feedback_requests%rowtype;
  v_student_user_id uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  select * into v_request from public.feedback_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;

  update public.feedback_requests set
    status = p_status,
    priority = coalesce(p_priority, priority),
    resolved_at = case when p_status in ('resolved', 'rejected', 'closed') then now() else null end,
    closed_at = case when p_status = 'closed' then now() else null end
  where id = p_request_id;

  insert into public.feedback_status_history (request_id, from_status, to_status, actor_id, note)
  values (p_request_id, v_request.status, p_status, auth.uid(), nullif(p_internal_note, ''));

  if btrim(coalesce(p_response, '')) <> '' then
    insert into public.feedback_replies (request_id, author_id, body, is_internal)
    values (p_request_id, auth.uid(), btrim(p_response), false);
  end if;
  if btrim(coalesce(p_internal_note, '')) <> '' then
    insert into public.feedback_replies (request_id, author_id, body, is_internal)
    values (p_request_id, auth.uid(), btrim(p_internal_note), true);
  end if;

  select p.id into v_student_user_id
  from public.profiles p where p.student_directory_id = v_request.student_directory_id limit 1;
  if v_student_user_id is not null then
    perform public.phase3_notify_user(
      v_student_user_id, 'Feedback request updated',
      'Your PE feedback request "' || v_request.subject || '" is now ' || replace(p_status, '_', ' ') || '.',
      'feedback', '/my-feedback', 'normal', null
    );
  end if;

  perform public.phase3_log('feedback_updated', 'feedback_requests', p_request_id::text,
    jsonb_build_object('status', p_status, 'priority', p_priority));
  return query select * from public.feedback_requests where id = p_request_id;
end;
$$;

create or replace function public.admin_save_game_rule_category(
  p_category_id uuid,
  p_data jsonb
) returns setof public.game_rule_categories
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_category_id is null then
    insert into public.game_rule_categories (name, slug, description, sort_order, is_active)
    values (btrim(p_data->>'name'), lower(btrim(p_data->>'slug')),
      nullif(p_data->>'description', ''), coalesce((p_data->>'sort_order')::integer, 0),
      coalesce((p_data->>'is_active')::boolean, true)) returning id into v_id;
  else
    update public.game_rule_categories set
      name = btrim(p_data->>'name'), slug = lower(btrim(p_data->>'slug')),
      description = nullif(p_data->>'description', ''),
      sort_order = coalesce((p_data->>'sort_order')::integer, 0),
      is_active = coalesce((p_data->>'is_active')::boolean, true)
    where id = p_category_id returning id into v_id;
  end if;
  perform public.phase3_log('game_rule_category_saved', 'game_rule_categories', v_id::text, p_data);
  return query select * from public.game_rule_categories where id = v_id;
end;
$$;

create or replace function public.admin_save_game_rule_post(
  p_post_id uuid,
  p_data jsonb,
  p_blocks jsonb default '[]'::jsonb
) returns setof public.game_rule_posts
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status text := coalesce(p_data->>'status', 'draft');
  v_existing public.game_rule_posts%rowtype;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;

  if p_post_id is not null then
    select * into v_existing from public.game_rule_posts where id = p_post_id;
  end if;

  if p_post_id is null then
    insert into public.game_rule_posts (
      category_id, title, slug, introduction, history, about_game, how_to_play,
      rules_text, equipment_required, players_count, playing_area, instructions,
      safety_instructions, video_urls, status, published_at, is_featured, is_pinned,
      created_by, updated_by
    ) values (
      nullif(p_data->>'category_id', '')::uuid,
      btrim(p_data->>'title'), lower(btrim(p_data->>'slug')),
      nullif(p_data->>'introduction', ''), nullif(p_data->>'history', ''),
      nullif(p_data->>'about_game', ''), nullif(p_data->>'how_to_play', ''),
      nullif(p_data->>'rules_text', ''), nullif(p_data->>'equipment_required', ''),
      nullif(p_data->>'players_count', ''), nullif(p_data->>'playing_area', ''),
      nullif(p_data->>'instructions', ''), nullif(p_data->>'safety_instructions', ''),
      case when p_data->'video_urls' is null then array[]::text[]
        else array(select jsonb_array_elements_text(p_data->'video_urls')) end,
      v_status,
      case when v_status = 'published' then now() else null end,
      coalesce((p_data->>'is_featured')::boolean, false),
      coalesce((p_data->>'is_pinned')::boolean, false),
      auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.game_rule_posts set
      category_id = nullif(p_data->>'category_id', '')::uuid,
      title = btrim(p_data->>'title'), slug = lower(btrim(p_data->>'slug')),
      introduction = nullif(p_data->>'introduction', ''),
      history = nullif(p_data->>'history', ''),
      about_game = nullif(p_data->>'about_game', ''),
      how_to_play = nullif(p_data->>'how_to_play', ''),
      rules_text = nullif(p_data->>'rules_text', ''),
      equipment_required = nullif(p_data->>'equipment_required', ''),
      players_count = nullif(p_data->>'players_count', ''),
      playing_area = nullif(p_data->>'playing_area', ''),
      instructions = nullif(p_data->>'instructions', ''),
      safety_instructions = nullif(p_data->>'safety_instructions', ''),
      video_urls = case when p_data->'video_urls' is null then array[]::text[]
        else array(select jsonb_array_elements_text(p_data->'video_urls')) end,
      status = v_status,
      published_at = case
        when v_status = 'published' and v_existing.published_at is null then now()
        when v_status = 'published' then v_existing.published_at
        else null
      end,
      is_featured = coalesce((p_data->>'is_featured')::boolean, false),
      is_pinned = coalesce((p_data->>'is_pinned')::boolean, false),
      updated_by = auth.uid()
    where id = p_post_id returning id into v_id;

    delete from public.game_rule_blocks where post_id = v_id;
  end if;

  insert into public.game_rule_blocks (post_id, block_type, content, sort_order)
  select v_id, b.value->>'block_type',
    coalesce(b.value->'content', '{}'::jsonb),
    coalesce((b.value->>'sort_order')::integer, b.ordinal::integer)
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) with ordinality as b(value, ordinal);

  perform public.phase3_log('game_rule_post_saved', 'game_rule_posts', v_id::text,
    jsonb_build_object('status', v_status, 'blocks', jsonb_array_length(coalesce(p_blocks, '[]'::jsonb))));
  return query select * from public.game_rule_posts where id = v_id;
end;
$$;

-- ===========================================================================
-- Notifications and Resend announcement queue
-- ===========================================================================

create or replace function public.admin_create_student_group(
  p_group_id uuid,
  p_data jsonb
) returns setof public.student_groups
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_group_id is null then
    insert into public.student_groups (name, description, created_by)
    values (btrim(p_data->>'name'), nullif(p_data->>'description', ''), auth.uid())
    returning id into v_id;
  else
    update public.student_groups set
      name = btrim(p_data->>'name'),
      description = nullif(p_data->>'description', ''),
      is_active = coalesce((p_data->>'is_active')::boolean, true)
    where id = p_group_id returning id into v_id;
  end if;
  perform public.phase3_log('student_group_saved', 'student_groups', v_id::text, p_data);
  return query select * from public.student_groups where id = v_id;
end;
$$;

create or replace function public.admin_set_group_member(
  p_group_id uuid,
  p_student_directory_id uuid,
  p_member boolean
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_member then
    insert into public.student_group_members (group_id, student_directory_id)
    values (p_group_id, p_student_directory_id)
    on conflict (group_id, student_directory_id) do nothing;
  else
    delete from public.student_group_members
    where group_id = p_group_id and student_directory_id = p_student_directory_id;
  end if;
  perform public.phase3_log('student_group_member_changed', 'student_group_members',
    p_group_id::text, jsonb_build_object('student_directory_id', p_student_directory_id, 'member', p_member));
end;
$$;

create or replace function public.admin_create_announcement(
  p_data jsonb,
  p_audiences jsonb,
  p_send_email boolean default false,
  p_daily_limit integer default 100
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_announcement_id uuid;
  v_email_id uuid;
  v_notified integer := 0;
  v_recipients integer := 0;
  v_audience_summary text;
  v_user_id uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_audiences is null or jsonb_array_length(p_audiences) = 0 then
    raise exception 'Select at least one audience';
  end if;
  if p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'Daily limit must be between 1 and 100';
  end if;

  select string_agg(case a.value->>'audience_type'
      when 'all_students' then 'All students'
      when 'active_pe' then 'Active PE students'
      when 'department' then 'Department ' || coalesce(a.value->>'department_id', '')
      when 'semester' then 'Semester ' || coalesce(a.value->>'semester', '')
      when 'selected_students' then 'Selected students'
      when 'group' then 'Student group'
      else a.value->>'audience_type' end, ', ')
  into v_audience_summary
  from jsonb_array_elements(p_audiences) as a(value);

  insert into public.announcements (title, message, link, priority, audience_summary, created_by, attachment_file_id)
  values (
    btrim(p_data->>'title'), btrim(p_data->>'message'), nullif(p_data->>'link', ''),
    coalesce(p_data->>'priority', 'normal'), v_audience_summary, auth.uid(),
    nullif(p_data->>'attachment_file_id', '')::uuid
  ) returning id into v_announcement_id;

  insert into public.announcement_audiences (
    announcement_id, audience_type, department_id, semester, student_directory_id, group_id
  )
  select v_announcement_id, a.value->>'audience_type',
    nullif(a.value->>'department_id', '')::uuid,
    nullif(a.value->>'semester', '')::smallint,
    nullif(a.value->>'student_directory_id', '')::uuid,
    nullif(a.value->>'group_id', '')::uuid
  from jsonb_array_elements(p_audiences) as a(value);

  for v_user_id in
    select p.id
    from public.profiles p
    where p.account_status = 'active'
      and public.phase3_matches_audience(p_audiences, p.id)
  loop
    if public.phase3_notify_user(
      v_user_id, p_data->>'title', p_data->>'message', 'announcement',
      nullif(p_data->>'link', ''), coalesce(p_data->>'priority', 'normal'), v_announcement_id
    ) is not null then
      v_notified := v_notified + 1;
    end if;
  end loop;

  if p_send_email then
    insert into public.email_announcements (
      announcement_id, title, body, link, attachment_file_id, audience_summary, daily_limit, created_by
    ) values (
      v_announcement_id, btrim(p_data->>'title'), btrim(p_data->>'message'),
      nullif(p_data->>'link', ''), nullif(p_data->>'attachment_file_id', '')::uuid,
      v_audience_summary, p_daily_limit, auth.uid()
    ) returning id into v_email_id;

    insert into public.email_recipients (email_announcement_id, user_id, email)
    select v_email_id, u.id, u.email
    from auth.users u
    join public.profiles p on p.id = u.id
    where p.account_status = 'active'
      and u.email_confirmed_at is not null
      and u.email is not null
      and public.phase3_matches_audience(p_audiences, u.id);
    get diagnostics v_recipients = row_count;
  end if;

  perform public.phase3_log('announcement_created', 'announcements', v_announcement_id::text,
    jsonb_build_object('email', p_send_email, 'notified', v_notified, 'recipients', v_recipients));

  return jsonb_build_object(
    'announcement_id', v_announcement_id,
    'email_announcement_id', v_email_id,
    'notified_count', v_notified,
    'recipient_count', v_recipients
  );
end;
$$;

create or replace function public.student_mark_notification_read(
  p_notification_id uuid,
  p_read boolean default true
) returns setof public.notifications
language sql security definer set search_path = public, pg_temp
as $$
  update public.notifications
  set read_at = case when p_read then now() else null end
  where id = p_notification_id and user_id = auth.uid()
  returning *;
$$;

create or replace function public.student_mark_all_notifications_read()
returns integer
language sql security definer set search_path = public, pg_temp
as $$
  with updated as (
    update public.notifications set read_at = now()
    where user_id = auth.uid() and read_at is null
    returning id
  )
  select count(*)::integer from updated;
$$;

create or replace function public.student_set_notification_preference(
  p_category text,
  p_channel text,
  p_enabled boolean
) returns setof public.notification_preferences
language sql security definer set search_path = public, pg_temp
as $$
  insert into public.notification_preferences (user_id, category, channel, enabled)
  values (auth.uid(), p_category, p_channel, p_enabled)
  on conflict (user_id, category, channel) do update set
    enabled = excluded.enabled, updated_at = now()
  returning *;
$$;

create or replace function public.admin_claim_email_batch(
  p_email_announcement_id uuid,
  p_batch_size integer default 25
) returns table (
  recipient_id uuid,
  user_id uuid,
  email text,
  title text,
  body text,
  link text,
  attempt_number integer
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_accepted integer;
  v_take integer;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_batch_size < 1 then raise exception 'Batch size must be positive'; end if;

  select daily_limit into v_limit from public.email_announcements where id = p_email_announcement_id;
  if not found then raise exception 'Email announcement not found'; end if;

  insert into public.email_daily_usage (usage_date, accepted_count)
  values (v_today, 0) on conflict (usage_date) do nothing;
  select accepted_count into v_accepted from public.email_daily_usage where usage_date = v_today;
  v_take := least(p_batch_size, 25, greatest(v_limit - v_accepted, 0));
  if v_take = 0 then return; end if;

  return query
  with claimed as (
    select r.id from public.email_recipients r
    where r.email_announcement_id = p_email_announcement_id
      and r.status in ('queued', 'failed')
      and r.attempts < 3
    order by r.queued_at, r.id
    for update skip locked
    limit v_take
  )
  update public.email_recipients r
  set status = 'sending', attempts = r.attempts + 1, updated_at = now()
  from claimed c
  where r.id = c.id
  returning r.id, r.user_id, r.email,
    (select a.title from public.email_announcements a where a.id = r.email_announcement_id),
    (select a.body from public.email_announcements a where a.id = r.email_announcement_id),
    (select a.link from public.email_announcements a where a.id = r.email_announcement_id),
    r.attempts;
end;
$$;

create or replace function public.admin_record_email_result(
  p_recipient_id uuid,
  p_provider_status text,
  p_provider_message_id text default null,
  p_error text default null
) returns setof public.email_recipients
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_recipient public.email_recipients%rowtype;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  select * into v_recipient from public.email_recipients where id = p_recipient_id for update;
  if not found then raise exception 'Recipient not found'; end if;
  if v_recipient.status in ('accepted', 'delivered', 'bounced') then
    return query select * from public.email_recipients where id = p_recipient_id;
    return;
  end if;

  if p_provider_status = 'accepted' then
    update public.email_recipients set
      status = 'accepted', accepted_at = now(),
      provider_message_id = p_provider_message_id, last_error = null
    where id = p_recipient_id;
    insert into public.email_daily_usage (usage_date, accepted_count)
    values (v_today, 1)
    on conflict (usage_date) do update set accepted_count = email_daily_usage.accepted_count + 1;
  else
    update public.email_recipients set
      status = 'failed', failed_at = now(), last_error = left(coalesce(p_error, 'Provider rejected the message'), 500)
    where id = p_recipient_id;
  end if;

  perform public.phase3_log('email_delivery_recorded', 'email_recipients', p_recipient_id::text,
    jsonb_build_object('provider_status', p_provider_status));
  return query select * from public.email_recipients where id = p_recipient_id;
end;
$$;

create or replace function public.admin_complete_email_announcement(
  p_email_announcement_id uuid
) returns setof public.email_announcements
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_remaining integer;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  select count(*)::integer into v_remaining
  from public.email_recipients
  where email_announcement_id = p_email_announcement_id
    and status in ('queued', 'sending', 'failed');

  update public.email_announcements set
    status = case when v_remaining = 0 then 'completed' else 'queued' end
  where id = p_email_announcement_id;
  return query select * from public.email_announcements where id = p_email_announcement_id;
end;
$$;

create or replace function public.admin_requeue_failed_emails(
  p_email_announcement_id uuid
) returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  update public.email_recipients
  set status = 'queued', last_error = null, updated_at = now()
  where email_announcement_id = p_email_announcement_id
    and status = 'failed' and attempts < 3;
  get diagnostics v_count = row_count;

  update public.email_announcements set status = 'queued'
  where id = p_email_announcement_id and v_count > 0;
  perform public.phase3_log('email_failures_requeued', 'email_recipients',
    p_email_announcement_id::text, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

create or replace function public.record_email_provider_event(
  p_provider_message_id text,
  p_event_type text,
  p_provider_event_id text,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_recipient_id uuid;
begin
  insert into public.email_delivery_events (recipient_id, provider_event_id, event_type, payload)
  select id, p_provider_event_id, p_event_type, p_payload
  from public.email_recipients where provider_message_id = p_provider_message_id
  on conflict (provider_event_id) do nothing;

  select id into v_recipient_id from public.email_recipients
  where provider_message_id = p_provider_message_id;

  if v_recipient_id is not null then
    if p_event_type = 'delivered' then
      update public.email_recipients
      set status = 'delivered', delivered_at = now() where id = v_recipient_id
        and status in ('accepted', 'delivered');
    elsif p_event_type in ('bounced', 'complained') then
      update public.email_recipients
      set status = 'bounced', failed_at = now() where id = v_recipient_id;
    end if;
  end if;
end;
$$;

-- ===========================================================================
-- Sports profiles, achievements and verified participation
-- ===========================================================================

create or replace function public.student_save_sports_profile(p_data jsonb)
returns setof public.sports_profile_details
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  insert into public.sports_profile_details (
    user_id, biography, sports_interests, preferred_sports, profile_photo_file_id, is_public
  ) values (
    auth.uid(),
    nullif(btrim(coalesce(p_data->>'biography', '')), ''),
    case when p_data->'sports_interests' is null then array[]::text[]
      else array(select jsonb_array_elements_text(p_data->'sports_interests')) end,
    case when p_data->'preferred_sports' is null then array[]::text[]
      else array(select jsonb_array_elements_text(p_data->'preferred_sports')) end,
    nullif(p_data->>'profile_photo_file_id', '')::uuid,
    coalesce((p_data->>'is_public')::boolean, false)
  )
  on conflict (user_id) do update set
    biography = nullif(btrim(coalesce(p_data->>'biography', '')), ''),
    sports_interests = case when p_data->'sports_interests' is null then array[]::text[]
      else array(select jsonb_array_elements_text(p_data->'sports_interests')) end,
    preferred_sports = case when p_data->'preferred_sports' is null then array[]::text[]
      else array(select jsonb_array_elements_text(p_data->'preferred_sports')) end,
    profile_photo_file_id = nullif(p_data->>'profile_photo_file_id', '')::uuid,
    is_public = coalesce((p_data->>'is_public')::boolean, false)
  where sports_profile_details.user_id = auth.uid();

  return query select * from public.sports_profile_details where user_id = auth.uid();
end;
$$;

create or replace function public.student_suggest_achievement(p_data jsonb)
returns setof public.sports_achievements
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_directory_id uuid := public.phase3_student_directory_id();
begin
  if v_directory_id is null then raise exception 'No active student directory record'; end if;

  insert into public.sports_achievements (
    student_directory_id, title, sport, event_name, academic_year, achievement_date,
    position_result, award_description, evidence_file_id, created_by
  ) values (
    v_directory_id, btrim(p_data->>'title'), btrim(p_data->>'sport'),
    nullif(p_data->>'event_name', ''), nullif(p_data->>'academic_year', ''),
    nullif(p_data->>'achievement_date', '')::date,
    nullif(p_data->>'position_result', ''), nullif(p_data->>'award_description', ''),
    nullif(p_data->>'evidence_file_id', '')::uuid, auth.uid()
  ) returning id into v_id;

  return query select * from public.sports_achievements where id = v_id;
end;
$$;

create or replace function public.admin_save_achievement(
  p_achievement_id uuid,
  p_data jsonb
) returns setof public.sports_achievements
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_achievement_id is null then
    insert into public.sports_achievements (
      student_directory_id, title, sport, event_name, academic_year, achievement_date,
      position_result, award_description, evidence_file_id, verification_status,
      verified_by, verified_at, source_type, created_by
    ) values (
      (p_data->>'student_directory_id')::uuid, btrim(p_data->>'title'), btrim(p_data->>'sport'),
      nullif(p_data->>'event_name', ''), nullif(p_data->>'academic_year', ''),
      nullif(p_data->>'achievement_date', '')::date,
      nullif(p_data->>'position_result', ''), nullif(p_data->>'award_description', ''),
      nullif(p_data->>'evidence_file_id', '')::uuid,
      coalesce(p_data->>'verification_status', 'pending'),
      case when p_data->>'verification_status' = 'verified' then auth.uid() else null end,
      case when p_data->>'verification_status' = 'verified' then now() else null end,
      'admin_record', auth.uid()
    ) returning id into v_id;
  else
    update public.sports_achievements set
      title = btrim(p_data->>'title'), sport = btrim(p_data->>'sport'),
      event_name = nullif(p_data->>'event_name', ''),
      academic_year = nullif(p_data->>'academic_year', ''),
      achievement_date = nullif(p_data->>'achievement_date', '')::date,
      position_result = nullif(p_data->>'position_result', ''),
      award_description = nullif(p_data->>'award_description', ''),
      evidence_file_id = nullif(p_data->>'evidence_file_id', '')::uuid
    where id = p_achievement_id returning id into v_id;
  end if;
  perform public.phase3_log('achievement_saved', 'sports_achievements', v_id::text, p_data);
  return query select * from public.sports_achievements where id = v_id;
end;
$$;

create or replace function public.admin_review_achievement(
  p_achievement_id uuid,
  p_status text,
  p_note text default null
) returns setof public.sports_achievements
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_achievement public.sports_achievements%rowtype;
  v_user_id uuid;
begin
  if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;
  if p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'Choose a valid verification status';
  end if;
  select * into v_achievement from public.sports_achievements where id = p_achievement_id for update;
  if not found then raise exception 'Achievement not found'; end if;

  update public.sports_achievements set
    verification_status = p_status,
    verified_by = case when p_status = 'verified' then auth.uid() else null end,
    verified_at = case when p_status = 'verified' then now() else null end,
    verification_note = nullif(p_note, '')
  where id = p_achievement_id;

  select p.id into v_user_id from public.profiles p
  where p.student_directory_id = v_achievement.student_directory_id limit 1;
  if v_user_id is not null then
    perform public.phase3_notify_user(
      v_user_id, 'Sports achievement ' || p_status,
      'Your achievement "' || v_achievement.title || '" is now ' || p_status || '.',
      'achievement', '/my-sports-profile', 'normal', null
    );
  end if;

  perform public.phase3_log('achievement_reviewed', 'sports_achievements', p_achievement_id::text,
    jsonb_build_object('status', p_status));
  return query select * from public.sports_achievements where id = p_achievement_id;
end;
$$;

create or replace function public.get_public_sports_profile(p_student_directory_id uuid)
returns table (
  full_name text,
  department_name text,
  academic_year smallint,
  semester smallint,
  biography text,
  preferred_sports text[],
  sports_interests text[],
  achievements jsonb
)
language sql security definer stable set search_path = public, pg_temp
as $$
  select
    sd.full_name,
    d.department_name,
    sd.academic_year,
    sd.semester,
    spd.biography,
    spd.preferred_sports,
    spd.sports_interests,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', a.title, 'sport', a.sport, 'event_name', a.event_name,
        'academic_year', a.academic_year, 'achievement_date', a.achievement_date,
        'position_result', a.position_result, 'award_description', a.award_description
      ) order by a.achievement_date desc nulls last)
      from public.sports_achievements a
      where a.student_directory_id = sd.id
        and a.verification_status = 'verified'
    ), '[]'::jsonb) as achievements
  from public.student_directory sd
  join public.departments d on d.id = sd.department_id
  join public.profiles p on p.student_directory_id = sd.id and p.account_status = 'active'
  join public.sports_profile_details spd on spd.user_id = p.id and spd.is_public
  where sd.id = p_student_directory_id and sd.is_active;
$$;

create or replace function public.phase3_sync_attendance_participation()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status in ('present', 'represented') and new.reviewed_at is not null then
    insert into public.sports_participation_records (
      student_directory_id, source_type, source_reference, activity_title, participated_at, is_verified
    ) values (
      new.student_directory_id, 'attendance', new.session_id::text,
      (select title from public.attendance_sessions where id = new.session_id),
      coalesce(new.reviewed_at, new.updated_at), true
    ) on conflict (student_directory_id, source_type, source_reference) do nothing;
  end if;
  return new;
end;
$$;

create trigger attendance_records_phase3_participation
after insert or update of status, reviewed_at on public.attendance_records
for each row execute function public.phase3_sync_attendance_participation();

create or replace function public.phase3_sync_task_participation()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status in ('reviewed', 'completed') and new.reviewed_at is not null then
    insert into public.sports_participation_records (
      student_directory_id, source_type, source_reference, activity_title, participated_at, is_verified
    ) values (
      new.student_directory_id, 'class_task', new.task_id::text || ':' || new.id::text,
      (select title from public.class_tasks where id = new.task_id),
      coalesce(new.reviewed_at, new.submitted_at, new.created_at), true
    ) on conflict (student_directory_id, source_type, source_reference) do nothing;
  end if;
  return new;
end;
$$;

create trigger task_submissions_phase3_participation
after insert or update of status, reviewed_at on public.task_submissions
for each row execute function public.phase3_sync_task_participation();

-- Reusable notification hooks for existing Phase 2 records. They never create
-- duplicate attendance sessions or tasks; they only notify on state changes.
create or replace function public.phase3_notify_attendance_review()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_title text;
begin
  if new.reviewed_at is not null and (tg_op = 'INSERT' or old.reviewed_at is null)
     and new.status in ('present', 'represented', 'absent', 'excused') then
    select p.id into v_user_id from public.profiles p
      where p.student_directory_id = new.student_directory_id limit 1;
    select title into v_title from public.attendance_sessions where id = new.session_id;
    if v_user_id is not null then
      perform public.phase3_notify_user(
        v_user_id, 'PE attendance reviewed',
        'Your attendance for ' || coalesce(v_title, 'a PE session') || ' is ' || new.status || '.',
        'attendance', '/classroom/attendance', 'normal', null
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger attendance_records_phase3_notify
after insert or update of status, reviewed_at on public.attendance_records
for each row execute function public.phase3_notify_attendance_review();

create or replace function public.phase3_notify_task_published()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    insert into public.notifications (user_id, title, body, category, link, priority)
    select p.id, 'New PE task published', 'A new task is available: ' || new.title,
           'task', '/tasks/' || new.id::text, coalesce(new.priority, 'normal')
    from public.profiles p
    where p.account_status = 'active'
      and public.student_matches_task(new.id, p.id)
      and not exists (
        select 1 from public.notification_preferences np
        where np.user_id = p.id and np.category = 'task' and np.channel = 'in_app' and np.enabled = false
      );
  end if;
  return new;
end;
$$;

create trigger class_tasks_phase3_notify
after insert or update of status on public.class_tasks
for each row execute function public.phase3_notify_task_published();

-- ===========================================================================
-- Row Level Security. Every exposed Phase 3 table is enabled; UI hiding is
-- never the security boundary.
-- ===========================================================================

alter table public.phase3_files enable row level security;
alter table public.student_groups enable row level security;
alter table public.student_group_members enable row level security;
alter table public.equipment_categories enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_assets enable row level security;
alter table public.equipment_transactions enable row level security;
alter table public.equipment_return_records enable row level security;
alter table public.equipment_stock_adjustments enable row level security;
alter table public.equipment_maintenance_records enable row level security;
alter table public.equipment_qr_links enable row level security;
alter table public.pe_calendar_events enable row level security;
alter table public.calendar_audiences enable row level security;
alter table public.calendar_recurrence_rules enable row level security;
alter table public.calendar_event_overrides enable row level security;
alter table public.feedback_requests enable row level security;
alter table public.feedback_replies enable row level security;
alter table public.feedback_status_history enable row level security;
alter table public.game_rule_categories enable row level security;
alter table public.game_rule_posts enable row level security;
alter table public.game_rule_blocks enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_audiences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_announcements enable row level security;
alter table public.email_recipients enable row level security;
alter table public.email_delivery_events enable row level security;
alter table public.email_daily_usage enable row level security;
alter table public.sports_profile_details enable row level security;
alter table public.sports_achievements enable row level security;
alter table public.sports_participation_records enable row level security;

create policy phase3_files_admin_all on public.phase3_files for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy phase3_files_uploader_read on public.phase3_files for select to authenticated
  using (uploader_id = auth.uid());
create policy phase3_files_public_read on public.phase3_files for select to anon, authenticated
  using (
    upload_status = 'confirmed' and visibility = 'public'
    and (
      (parent_type in ('game_rule_image', 'game_rule_document') and exists (
        select 1 from public.game_rule_posts p
        where p.id = parent_id and p.status = 'published'
      ))
      or (parent_type = 'sports_profile_photo' and exists (
        select 1 from public.sports_profile_details s
        where s.profile_photo_file_id = public.phase3_files.id and s.is_public
      ))
    )
  );

create policy student_groups_admin_all on public.student_groups for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy student_group_members_admin_all on public.student_group_members for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy student_group_members_own_read on public.student_group_members for select to authenticated
  using (student_directory_id = public.phase3_student_directory_id());

create policy equipment_categories_admin_all on public.equipment_categories for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy equipment_categories_read on public.equipment_categories for select to authenticated
  using (is_active or public.is_pe_admin());

create policy equipment_items_admin_all on public.equipment_items for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy equipment_items_read on public.equipment_items for select to authenticated
  using (is_active or public.is_pe_admin());

create policy equipment_assets_admin_all on public.equipment_assets for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy equipment_assets_read on public.equipment_assets for select to authenticated
  using (true);

create policy equipment_transactions_admin_all on public.equipment_transactions for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy equipment_transactions_own_read on public.equipment_transactions for select to authenticated
  using (student_directory_id = public.phase3_student_directory_id());

create policy equipment_return_records_admin_all on public.equipment_return_records for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy equipment_return_records_own_read on public.equipment_return_records for select to authenticated
  using (exists (
    select 1 from public.equipment_transactions t
    where t.id = transaction_id and t.student_directory_id = public.phase3_student_directory_id()
  ));

create policy equipment_stock_adjustments_admin_all on public.equipment_stock_adjustments for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy equipment_maintenance_admin_all on public.equipment_maintenance_records for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy equipment_qr_links_admin_all on public.equipment_qr_links for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy pe_calendar_events_admin_all on public.pe_calendar_events for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy pe_calendar_events_visible_read on public.pe_calendar_events for select to authenticated
  using (public.can_view_calendar_event(id, auth.uid()));
create policy pe_calendar_events_public_read on public.pe_calendar_events for select to anon
  using (public.can_view_calendar_event(id, null));
create policy calendar_audiences_admin_all on public.calendar_audiences for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy calendar_recurrence_rules_admin_all on public.calendar_recurrence_rules for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy calendar_recurrence_rules_visible_read on public.calendar_recurrence_rules for select to anon, authenticated
  using (exists (
    select 1 from public.pe_calendar_events e
    where e.id = event_id and public.can_view_calendar_event(e.id, nullif(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid))
  ));
create policy calendar_event_overrides_admin_all on public.calendar_event_overrides for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy calendar_event_overrides_visible_read on public.calendar_event_overrides for select to anon, authenticated
  using (exists (
    select 1 from public.calendar_recurrence_rules r
    join public.pe_calendar_events e on e.id = r.event_id
    where r.id = rule_id and public.can_view_calendar_event(e.id, nullif(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid))
  ));

create policy feedback_requests_admin_all on public.feedback_requests for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy feedback_requests_own_read on public.feedback_requests for select to authenticated
  using (student_directory_id = public.phase3_student_directory_id());
create policy feedback_requests_own_insert on public.feedback_requests for insert to authenticated
  with check (student_directory_id = public.phase3_student_directory_id());

create policy feedback_replies_admin_all on public.feedback_replies for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy feedback_replies_own_read on public.feedback_replies for select to authenticated
  using (not is_internal and exists (
    select 1 from public.feedback_requests r
    where r.id = request_id and r.student_directory_id = public.phase3_student_directory_id()
  ));
create policy feedback_replies_own_insert on public.feedback_replies for insert to authenticated
  with check (
    is_internal = false and author_id = auth.uid() and exists (
      select 1 from public.feedback_requests r
      where r.id = request_id and r.student_directory_id = public.phase3_student_directory_id()
    )
  );
create policy feedback_status_history_admin_all on public.feedback_status_history for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy feedback_status_history_own_read on public.feedback_status_history for select to authenticated
  using (exists (
    select 1 from public.feedback_requests r
    where r.id = request_id and r.student_directory_id = public.phase3_student_directory_id()
  ));

create policy game_rule_categories_admin_all on public.game_rule_categories for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy game_rule_categories_public_read on public.game_rule_categories for select to anon, authenticated
  using (is_active);
create policy game_rule_posts_admin_all on public.game_rule_posts for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy game_rule_posts_public_read on public.game_rule_posts for select to anon, authenticated
  using (status = 'published');
create policy game_rule_blocks_admin_all on public.game_rule_blocks for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy game_rule_blocks_public_read on public.game_rule_blocks for select to anon, authenticated
  using (exists (
    select 1 from public.game_rule_posts p where p.id = post_id and p.status = 'published'
  ));

create policy announcements_admin_all on public.announcements for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy announcements_authenticated_read on public.announcements for select to authenticated
  using (true);
create policy announcement_audiences_admin_all on public.announcement_audiences for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notification_preferences_own_read on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

create policy email_announcements_admin_all on public.email_announcements for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy email_recipients_admin_all on public.email_recipients for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy email_delivery_events_admin_all on public.email_delivery_events for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy email_daily_usage_admin_all on public.email_daily_usage for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy sports_profile_details_admin_all on public.sports_profile_details for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy sports_profile_details_own_read on public.sports_profile_details for select to authenticated
  using (user_id = auth.uid());
create policy sports_profile_details_public_read on public.sports_profile_details for select to anon, authenticated
  using (is_public);

create policy sports_achievements_admin_all on public.sports_achievements for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy sports_achievements_own_read on public.sports_achievements for select to authenticated
  using (student_directory_id = public.phase3_student_directory_id());
create policy sports_achievements_public_verified_read on public.sports_achievements
  for select to anon, authenticated using (
    verification_status = 'verified' and exists (
      select 1 from public.sports_profile_details s
      where s.user_id = (select p.id from public.profiles p
        where p.student_directory_id = sports_achievements.student_directory_id limit 1)
        and s.is_public
    )
  );
create policy sports_participation_admin_all on public.sports_participation_records for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy sports_participation_own_read on public.sports_participation_records for select to authenticated
  using (student_directory_id = public.phase3_student_directory_id());

-- ===========================================================================
-- Grants: least privilege, with public access limited to safe projections.
-- ===========================================================================

revoke all on public.phase3_files, public.student_groups, public.student_group_members,
  public.equipment_categories, public.equipment_items, public.equipment_assets,
  public.equipment_transactions, public.equipment_return_records,
  public.equipment_stock_adjustments, public.equipment_maintenance_records,
  public.equipment_qr_links, public.pe_calendar_events, public.calendar_audiences,
  public.calendar_recurrence_rules, public.calendar_event_overrides,
  public.feedback_requests, public.feedback_replies, public.feedback_status_history,
  public.game_rule_categories, public.game_rule_posts, public.game_rule_blocks,
  public.announcements, public.announcement_audiences, public.notifications,
  public.notification_preferences, public.email_announcements, public.email_recipients,
  public.email_delivery_events, public.email_daily_usage, public.sports_profile_details,
  public.sports_achievements, public.sports_participation_records
  from anon, authenticated;

grant select, insert, update, delete on public.phase3_files,
  public.student_groups, public.student_group_members, public.equipment_categories,
  public.equipment_items, public.equipment_assets, public.equipment_transactions,
  public.equipment_return_records, public.equipment_stock_adjustments,
  public.equipment_maintenance_records, public.equipment_qr_links,
  public.pe_calendar_events, public.calendar_audiences, public.calendar_recurrence_rules,
  public.calendar_event_overrides, public.feedback_requests, public.feedback_replies,
  public.feedback_status_history, public.game_rule_categories, public.game_rule_posts,
  public.game_rule_blocks, public.announcements, public.announcement_audiences,
  public.sports_profile_details, public.sports_achievements,
  public.sports_participation_records to authenticated;

grant select on public.notifications, public.notification_preferences,
  public.email_announcements, public.email_recipients, public.email_delivery_events,
  public.email_daily_usage to authenticated;

grant select on public.game_rule_categories, public.game_rule_posts, public.game_rule_blocks,
  public.pe_calendar_events, public.calendar_recurrence_rules, public.calendar_event_overrides,
  public.phase3_files, public.sports_profile_details, public.sports_achievements to anon;

-- Function grants. Internal helpers stay ungranted; the webhook function is
-- intentionally service-role-only.
revoke all on function public.phase3_log(text, text, text, jsonb) from public;
revoke all on function public.phase3_student_directory_id(uuid) from public;
revoke all on function public.phase3_matches_audience(jsonb, uuid) from public;
revoke all on function public.phase3_notify_user(uuid, text, text, text, text, text, uuid) from public;
revoke all on function public.phase3_sync_attendance_participation() from public;
revoke all on function public.phase3_sync_task_participation() from public;
revoke all on function public.phase3_notify_attendance_review() from public;
revoke all on function public.phase3_notify_task_published() from public;
revoke all on function public.record_email_provider_event(text, text, text, jsonb) from public;

grant execute on function public.phase3_student_directory_id(uuid) to authenticated;
grant execute on function public.phase3_matches_audience(jsonb, uuid) to authenticated;
grant execute on function public.can_view_calendar_event(uuid, uuid) to anon, authenticated;
grant execute on function public.student_matches_calendar(uuid, uuid) to authenticated;
grant execute on function public.admin_save_equipment_category(uuid, jsonb) to authenticated;
grant execute on function public.admin_save_equipment_item(uuid, jsonb) to authenticated;
grant execute on function public.admin_create_equipment_asset(uuid, jsonb) to authenticated;
grant execute on function public.admin_adjust_equipment_stock(uuid, integer, text) to authenticated;
grant execute on function public.borrow_equipment(uuid, uuid, integer, timestamptz, text, uuid) to authenticated;
grant execute on function public.return_equipment(uuid, integer, text, boolean, text) to authenticated;
grant execute on function public.admin_correct_equipment_transaction(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_save_equipment_maintenance(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_equipment_maintenance_status(uuid, text, text, numeric) to authenticated;
grant execute on function public.admin_create_equipment_qr(text, uuid, uuid) to authenticated;
grant execute on function public.resolve_equipment_qr(text) to authenticated;
grant execute on function public.admin_save_calendar_event(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.admin_save_calendar_override(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.student_submit_feedback(jsonb) to authenticated;
grant execute on function public.student_reply_feedback(uuid, text) to authenticated;
grant execute on function public.admin_update_feedback(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_save_game_rule_category(uuid, jsonb) to authenticated;
grant execute on function public.admin_save_game_rule_post(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.admin_create_student_group(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_group_member(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_create_announcement(jsonb, jsonb, boolean, integer) to authenticated;
grant execute on function public.student_mark_notification_read(uuid, boolean) to authenticated;
grant execute on function public.student_mark_all_notifications_read() to authenticated;
grant execute on function public.student_set_notification_preference(text, text, boolean) to authenticated;
grant execute on function public.admin_claim_email_batch(uuid, integer) to authenticated;
grant execute on function public.admin_record_email_result(uuid, text, text, text) to authenticated;
grant execute on function public.admin_complete_email_announcement(uuid) to authenticated;
grant execute on function public.admin_requeue_failed_emails(uuid) to authenticated;
grant execute on function public.student_save_sports_profile(jsonb) to authenticated;
grant execute on function public.student_suggest_achievement(jsonb) to authenticated;
grant execute on function public.admin_save_achievement(uuid, jsonb) to authenticated;
grant execute on function public.admin_review_achievement(uuid, text, text) to authenticated;
grant execute on function public.get_public_sports_profile(uuid) to anon, authenticated;

comment on table public.phase3_files is
  'Private-by-default R2 metadata; insertion and confirmation use role-checked RPCs.';
comment on table public.email_recipients is
  'Individual Resend deliveries only. Never expose addresses in group pages.';
comment on table public.sports_achievements is
  'Student entries are pending; only PE Admin verification makes an achievement verified.';

