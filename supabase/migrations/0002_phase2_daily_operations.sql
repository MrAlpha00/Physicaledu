-- ============================================================================
-- Phase 2 — Classroom, attendance, tasks, visitors, rooms and QR operations
-- Apply AFTER 0001_phase1_foundation.sql. Additive only: no drop, no destructive
-- alteration, no replacement of Phase 1 data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared Phase 2 helpers (restricted search_path, least-privilege grants)
-- ---------------------------------------------------------------------------

create or replace function public.ist_day_start(p_date date default (now() at time zone 'Asia/Kolkata')::date)
returns timestamptz
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_date::timestamp at time zone 'Asia/Kolkata');
$$;

create or replace function public.ist_day_end(p_date date default (now() at time zone 'Asia/Kolkata')::date)
returns timestamptz
language sql
immutable
set search_path = public, pg_temp
as $$
  select ((p_date + 1)::timestamp at time zone 'Asia/Kolkata');
$$;

create or replace function public.student_directory_id_for_user(p_user_id uuid default auth.uid())
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select p.student_directory_id
  from public.profiles p
  where p.id = p_user_id and p.account_status = 'active';
$$;

-- Single source of truth for PE classroom eligibility. Uses the Phase 1 roster
-- and never a client-supplied flag.
create or replace function public.is_active_pe_student(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.student_directory sd on sd.id = p.student_directory_id
    join public.pe_memberships pm on pm.student_directory_id = sd.id
    where p.id = p_user_id
      and p.account_status = 'active'
      and sd.is_active
      and pm.status = 'active'
  );
$$;

-- Internal audit writer. Explicit calls keep decision history compact and
-- avoid copying raw QR tokens or whole visitor records into audit_logs.
create or replace function public.write_audit(
  p_action text,
  p_target_table text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_target_table, p_target_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Admin-only wrapper for deliberate actions (such as exports) that need an
-- audit entry but do not otherwise mutate a Phase 2 table.
create or replace function public.admin_log_action(
  p_action text,
  p_target_table text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_pe_admin() then
    raise exception 'PE Admin access required';
  end if;
  perform public.write_audit(p_action, p_target_table, p_target_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  class_date date not null,
  starts_at timestamptz not null,
  expected_ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'finalised')),
  instructions text,
  created_by uuid references auth.users (id) on delete set null,
  allow_concurrent boolean not null default false,
  concurrent_reason text,
  opened_at timestamptz,
  closed_at timestamptz,
  finalised_at timestamptz,
  finalised_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_session_title_not_blank check (btrim(title) <> ''),
  constraint attendance_session_period check (expected_ends_at > starts_at),
  constraint attendance_session_concurrent_reason check (
    allow_concurrent = false or btrim(coalesce(concurrent_reason, '')) <> ''
  ),
  constraint attendance_session_lifecycle check (
    (status = 'draft' and opened_at is null and closed_at is null and finalised_at is null)
    or (status = 'open' and opened_at is not null and closed_at is null and finalised_at is null)
    or (status = 'closed' and opened_at is not null and closed_at is not null and finalised_at is null)
    or (status in ('closed', 'finalised') and opened_at is not null and closed_at is not null)
  )
);
-- The lifecycle check above intentionally permits finalised with all timestamps.

create index attendance_sessions_status_idx on public.attendance_sessions (status);
create index attendance_sessions_class_date_idx on public.attendance_sessions (class_date desc);
create unique index attendance_sessions_one_open_idx
  on public.attendance_sessions ((1)) where status = 'open' and allow_concurrent = false;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.attendance_sessions (id) on delete cascade,
  student_directory_id uuid not null
    references public.student_directory (id) on delete restrict,
  membership_id uuid references public.pe_memberships (id) on delete set null,
  status text not null default 'not_submitted'
    check (status in ('not_submitted', 'pending', 'present', 'represented', 'absent', 'excused')),
  submitted_type text check (submitted_type in ('attended', 'represented')),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  administrative_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_one_per_student unique (session_id, student_directory_id),
  constraint attendance_records_submitted_fields check (
    (status = 'not_submitted' and submitted_type is null and submitted_at is null)
    or (status = 'pending' and submitted_type is not null and submitted_at is not null)
    -- Reviewed/manual decisions may be made without a student submission.
    or status in ('present', 'represented', 'absent', 'excused')
  ),
  constraint attendance_records_review_fields check (
    (status in ('not_submitted', 'pending') and reviewed_at is null)
    or (status not in ('not_submitted', 'pending') and reviewed_at is not null and reviewed_by is not null)
  )
);

create index attendance_records_session_idx on public.attendance_records (session_id);
create index attendance_records_student_idx on public.attendance_records (student_directory_id);
create index attendance_records_status_idx on public.attendance_records (status);
create index attendance_records_session_status_idx
  on public.attendance_records (session_id, status);

create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function public.set_updated_at();
create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tasks, audiences, submissions and private file metadata
-- ---------------------------------------------------------------------------

create table public.class_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'general',
  starts_at timestamptz not null default now(),
  due_at timestamptz not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  instructions text,
  submission_requirements text,
  allow_text boolean not null default true,
  allow_files boolean not null default true,
  allow_links boolean not null default false,
  max_file_size_bytes integer not null default 20971520
    check (max_file_size_bytes between 1024 and 104857600),
  allowed_file_types text[] not null default array['pdf','jpg','jpeg','png','webp','docx','xlsx','txt']::text[],
  max_files integer not null default 10 check (max_files between 0 and 10),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_tasks_title_not_blank check (btrim(title) <> ''),
  constraint class_tasks_due_after_start check (due_at > starts_at),
  constraint class_tasks_submission_option check (allow_text or allow_files or allow_links)
);

create index class_tasks_status_idx on public.class_tasks (status);
create index class_tasks_due_idx on public.class_tasks (due_at);

create table public.task_audiences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.class_tasks (id) on delete cascade,
  audience_type text not null check (
    audience_type in ('all_students', 'active_pe', 'department', 'semester', 'selected_students')
  ),
  department_id uuid references public.departments (id) on delete cascade,
  semester smallint check (semester between 1 and 12),
  student_directory_id uuid references public.student_directory (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint task_audience_target check (
    (audience_type = 'all_students' and department_id is null and semester is null and student_directory_id is null)
    or (audience_type = 'active_pe' and department_id is null and semester is null and student_directory_id is null)
    or (audience_type = 'department' and department_id is not null and semester is null and student_directory_id is null)
    or (audience_type = 'semester' and semester is not null and department_id is null and student_directory_id is null)
    or (audience_type = 'selected_students' and student_directory_id is not null and department_id is null and semester is null)
  )
);

create index task_audiences_task_idx on public.task_audiences (task_id);
create index task_audiences_department_idx on public.task_audiences (department_id);
create index task_audiences_semester_idx on public.task_audiences (semester);
create index task_audiences_student_idx on public.task_audiences (student_directory_id);
create unique index task_audiences_unique_target_idx
  on public.task_audiences (
    task_id, audience_type,
    coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(semester, 0),
    coalesce(student_directory_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- OR-based task targeting: a student is eligible when at least one audience row
-- matches. Defined after task_audiences so the SQL body can be validated at
-- migration time.
create or replace function public.student_matches_task(p_task_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.task_audiences ta
    where ta.task_id = p_task_id
      and (
        ta.audience_type = 'all_students'
        or (
          ta.audience_type = 'active_pe'
          and public.is_active_pe_student(p_user_id)
        )
        or (
          ta.audience_type = 'department'
          and exists (
            select 1 from public.profiles p
            join public.student_directory sd on sd.id = p.student_directory_id
            where p.id = p_user_id and sd.department_id = ta.department_id
          )
        )
        or (
          ta.audience_type = 'semester'
          and exists (
            select 1 from public.profiles p
            join public.student_directory sd on sd.id = p.student_directory_id
            where p.id = p_user_id and sd.semester = ta.semester
          )
        )
        or (
          ta.audience_type = 'selected_students'
          and ta.student_directory_id = public.student_directory_id_for_user(p_user_id)
        )
      )
  );
$$;

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.class_tasks (id) on delete cascade,
  student_directory_id uuid not null
    references public.student_directory (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'reviewed', 'needs_correction', 'completed')),
  text_content text,
  link_url text,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_submissions_one_per_student unique (task_id, student_directory_id),
  constraint task_submissions_submitted_fields check (
    (status = 'pending' and submitted_at is null)
    or (status <> 'pending' and submitted_at is not null)
  ),
  constraint task_submissions_link_format check (
    link_url is null or link_url ~* '^https?://[^[:space:]]+$'
  )
);

create index task_submissions_task_idx on public.task_submissions (task_id);
create index task_submissions_user_idx on public.task_submissions (user_id);
create index task_submissions_status_idx on public.task_submissions (status);

create table public.task_submission_history (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.task_submissions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index task_submission_history_submission_idx
  on public.task_submission_history (submission_id, created_at desc);

create table public.stored_files (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  bucket text not null,
  original_filename text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  uploader_id uuid references auth.users (id) on delete set null,
  parent_type text not null check (parent_type in ('task_reference', 'task_submission')),
  parent_id uuid not null,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'confirmed', 'failed')),
  sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stored_files_parent_idx on public.stored_files (parent_type, parent_id);
create index stored_files_uploader_idx on public.stored_files (uploader_id);

create trigger class_tasks_set_updated_at
  before update on public.class_tasks
  for each row execute function public.set_updated_at();
create trigger task_submissions_set_updated_at
  before update on public.task_submissions
  for each row execute function public.set_updated_at();
create trigger stored_files_set_updated_at
  before update on public.stored_files
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Digital visitor register
-- ---------------------------------------------------------------------------

create table public.visitor_purposes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visitor_purposes_label_not_blank check (btrim(label) <> '')
);

create unique index visitor_purposes_label_uidx on public.visitor_purposes (lower(btrim(label)));
create index visitor_purposes_active_idx on public.visitor_purposes (is_active, sort_order);

-- Purpose options are configuration, known from the Phase 2 requirements.
insert into public.visitor_purposes (label, sort_order) values
  ('Playing sports', 10),
  ('Gym', 20),
  ('Mental games', 30),
  ('Meeting PE Sir', 40),
  ('Attending PE class', 50),
  ('Official work', 60),
  ('Other', 70)
on conflict (lower(btrim(label))) do nothing;

create table public.visitor_records (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid, -- FK added after qr_codes is created
  visitor_user_id uuid references auth.users (id) on delete set null,
  student_directory_id uuid references public.student_directory (id) on delete set null,
  full_name text not null,
  usn text,
  department_id uuid references public.departments (id) on delete set null,
  academic_year smallint check (academic_year between 1 and 6),
  semester smallint check (semester between 1 and 12),
  purpose_id uuid not null references public.visitor_purposes (id) on delete restrict,
  purpose_detail text,
  description text,
  identity_source text not null check (identity_source in ('authenticated_profile', 'guest_input')),
  bot_check_passed boolean not null default false,
  visited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint visitor_records_name_not_blank check (btrim(full_name) <> ''),
  constraint visitor_records_other_detail check (
    true -- purpose label 'Other' is validated in the trusted submit function
  )
);

create index visitor_records_visited_idx on public.visitor_records (visited_at desc);
create index visitor_records_purpose_idx on public.visitor_records (purpose_id);
create index visitor_records_department_idx on public.visitor_records (department_id);
create index visitor_records_user_idx on public.visitor_records (visitor_user_id);

create trigger visitor_purposes_set_updated_at
  before update on public.visitor_purposes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rooms and QR management
-- ---------------------------------------------------------------------------

create table public.pe_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  instructions text,
  requires_activity boolean not null default false,
  max_session_minutes integer not null default 120
    check (max_session_minutes between 15 and 720),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pe_rooms_code_format check (code ~ '^[a-z_]{3,40}$'),
  constraint pe_rooms_name_not_blank check (btrim(name) <> '')
);

-- The three known PE facilities are configuration, not invented records.
insert into public.pe_rooms (code, name, description, instructions, requires_activity)
values
  ('playing_room', 'Playing Room', 'Indoor playing area for racket, bat and ball activities.', 'Scan on entry, choose an activity, then scan again on exit.', true),
  ('gym_room', 'Gym Room', 'Fitness and strength training area.', 'Scan on entry and again on exit. No activity selection is needed.', false),
  ('mental_games_room', 'Mental Games Room', 'Indoor strategy and table games area.', 'Scan on entry, choose a game, then scan again on exit.', true)
on conflict (code) do nothing;

create table public.room_activities (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.pe_rooms (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_activities_name_not_blank check (btrim(name) <> '')
);

create index room_activities_room_idx on public.room_activities (room_id, is_active, sort_order);
create unique index room_activities_unique_idx on public.room_activities (room_id, lower(btrim(name)));

create table public.room_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.pe_rooms (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  student_directory_id uuid not null
    references public.student_directory (id) on delete restrict,
  activity_id uuid references public.room_activities (id) on delete set null,
  activity_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  force_closed_by uuid references auth.users (id) on delete set null,
  force_closed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_sessions_period check (ended_at is null or ended_at >= started_at)
);

-- Database-level duplicate protection for active sessions.
create unique index room_sessions_one_active_idx
  on public.room_sessions (room_id, student_directory_id) where ended_at is null;
create index room_sessions_room_started_idx on public.room_sessions (room_id, started_at desc);
create index room_sessions_student_idx on public.room_sessions (student_directory_id);
create index room_sessions_active_idx on public.room_sessions (started_at) where ended_at is null;

create trigger pe_rooms_set_updated_at
  before update on public.pe_rooms
  for each row execute function public.set_updated_at();
create trigger room_activities_set_updated_at
  before update on public.room_activities
  for each row execute function public.set_updated_at();
create trigger room_sessions_set_updated_at
  before update on public.room_sessions
  for each row execute function public.set_updated_at();

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qr_type text not null check (
    qr_type in ('visitor_entrance', 'playing_room', 'gym_room', 'mental_games_room', 'equipment')
  ),
  token text not null unique,
  destination_path text not null,
  room_id uuid references public.pe_rooms (id) on delete set null,
  theme text not null check (
    theme in ('entrance', 'playing', 'gym', 'mental', 'equipment')
  ),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_name_not_blank check (btrim(name) <> ''),
  constraint qr_codes_destination check (destination_path like '/%'),
  constraint qr_codes_room_match check (
    (qr_type in ('playing_room', 'gym_room', 'mental_games_room') and room_id is not null)
    or (qr_type not in ('playing_room', 'gym_room', 'mental_games_room') and room_id is null)
  )
);

-- High-entropy opaque tokens (never sequential IDs).
create function public.new_qr_token() returns text
language sql volatile set search_path = public, pg_temp as $$
  select replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '=', '');
$$;

insert into public.qr_codes (name, qr_type, token, destination_path, room_id, theme)
select v.name, v.qr_type, public.new_qr_token(), v.destination_path, r.id, v.theme
from (values
  ('PE Block Entrance', 'visitor_entrance', '/visit', 'entrance'),
  ('Playing Room', 'playing_room', '/room', 'playing'),
  ('Gym Room', 'gym_room', '/room', 'gym'),
  ('Mental Games Room', 'mental_games_room', '/room', 'mental')
) as v(name, qr_type, destination_path, theme)
left join public.pe_rooms r on r.code = v.qr_type;

create trigger qr_codes_set_updated_at
  before update on public.qr_codes
  for each row execute function public.set_updated_at();

alter table public.visitor_records
  add constraint visitor_records_qr_code_fkey
  foreign key (qr_code_id) references public.qr_codes (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Trusted RPCs — attendance
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_attendance_session(
  p_title text,
  p_class_date date,
  p_starts_at timestamptz,
  p_expected_ends_at timestamptz,
  p_instructions text default null,
  p_allow_concurrent boolean default false,
  p_concurrent_reason text default null
)
returns setof public.attendance_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.attendance_sessions;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'Session title is required' using errcode = '22023';
  end if;
  if p_expected_ends_at <= p_starts_at then
    raise exception 'Expected end time must be after start time' using errcode = '22023';
  end if;
  if p_allow_concurrent and btrim(coalesce(p_concurrent_reason, '')) = '' then
    raise exception 'A reason is required for a concurrent session' using errcode = '22023';
  end if;

  insert into public.attendance_sessions (
    title, class_date, starts_at, expected_ends_at, instructions,
    created_by, allow_concurrent, concurrent_reason
  )
  values (
    btrim(p_title), p_class_date, p_starts_at, p_expected_ends_at,
    nullif(btrim(coalesce(p_instructions, '')), ''),
    v_user, p_allow_concurrent,
    nullif(btrim(coalesce(p_concurrent_reason, '')), '')
  )
  returning * into v_session;

  -- Snapshot the active roster at creation time. Historical records survive
  -- later membership removal because attendance_records uses ON DELETE RESTRICT.
  insert into public.attendance_records (session_id, student_directory_id, membership_id)
  select v_session.id, pm.student_directory_id, pm.id
  from public.pe_memberships pm
  join public.student_directory sd on sd.id = pm.student_directory_id
  where pm.status = 'active' and sd.is_active;

  perform public.write_audit(
    'attendance_session_created', 'attendance_sessions', v_session.id::text,
    jsonb_build_object('title', v_session.title, 'class_date', v_session.class_date,
      'eligible_students', (select count(*) from public.attendance_records where session_id = v_session.id))
  );

  return query select * from public.attendance_sessions where id = v_session.id;
end;
$$;

create or replace function public.admin_set_attendance_session_status(
  p_session_id uuid,
  p_status text
)
returns setof public.attendance_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.attendance_sessions;
  v_previous_status text;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'open', 'closed', 'finalised') then
    raise exception 'Invalid session status' using errcode = '22023';
  end if;

  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Attendance session not found' using errcode = '22023';
  end if;

  v_previous_status := v_session.status;

  if p_status = 'open' and v_session.status <> 'open' then
    if v_session.allow_concurrent then
      update public.attendance_sessions set status = 'closed' where status = 'open' and id <> p_session_id;
    elsif exists (select 1 from public.attendance_sessions where status = 'open' and id <> p_session_id) then
      raise exception 'Another attendance session is already open' using errcode = '23514';
    end if;
  end if;

  update public.attendance_sessions
  set status = p_status,
      opened_at = case when p_status in ('open', 'closed', 'finalised') then coalesce(opened_at, now()) else null end,
      closed_at = case when p_status in ('closed', 'finalised') then coalesce(closed_at, now()) else null end,
      finalised_at = case when p_status = 'finalised' then coalesce(finalised_at, now()) else null end,
      finalised_by = case when p_status = 'finalised' then v_user else null end
  where id = p_session_id
  returning * into v_session;

  perform public.write_audit(
    'attendance_session_status_changed', 'attendance_sessions', p_session_id::text,
    jsonb_build_object('previous_status', v_previous_status, 'new_status', p_status)
  );

  return query select * from public.attendance_sessions where id = p_session_id;
end;
$$;

create or replace function public.student_submit_attendance(
  p_session_id uuid,
  p_type text
)
returns setof public.attendance_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_directory uuid;
  v_record public.attendance_records;
  v_session_status text;
  v_previous text;
  v_action text;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end
  if not public.is_active_pe_student(v_user) then
    raise exception 'Active PE membership is required for classroom attendance' using errcode = '42501';
  end if;
  if p_type not in ('attended', 'represented') then
    raise exception 'Invalid attendance type' using errcode = '22023';
  end if;

  v_directory := public.student_directory_id_for_user(v_user);
  select status into v_session_status from public.attendance_sessions where id = p_session_id;
  if v_session_status is distinct from 'open' then
    raise exception 'Attendance session is not open' using errcode = '23514';
  end if;

  select * into v_record
  from public.attendance_records
  where session_id = p_session_id and student_directory_id = v_directory
  for update;

  if not found then
    raise exception 'You are not eligible for this session' using errcode = '42501';
  end if;
  if v_record.status not in ('not_submitted', 'pending') then
    raise exception 'Reviewed attendance cannot be changed' using errcode = '23514';
  end if;

  v_previous := v_record.status;
  v_action := case when v_previous = 'pending' then 'attendance_corrected' else 'attendance_submitted' end;

  update public.attendance_records
  set status = 'pending',
      submitted_type = p_type,
      submitted_at = now(),
      reviewed_by = null,
      reviewed_at = null,
      administrative_note = null
  where id = v_record.id
  returning * into v_record;

  perform public.write_audit(v_action, 'attendance_records', v_record.id::text,
    jsonb_build_object('previous_status', v_previous, 'submitted_type', p_type,
      'session_id', p_session_id));

  return query select * from public.attendance_records where id = v_record.id;
end;
$$;

create or replace function public.admin_review_attendance(
  p_record_id uuid,
  p_decision text,
  p_note text default null
)
returns setof public.attendance_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_record public.attendance_records;
  v_previous text;
  v_new_status text;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;

  select * into v_record from public.attendance_records where id = p_record_id for update;
  if not found then
    raise exception 'Attendance record not found' using errcode = '22023';
  end if;

  v_previous := v_record.status;
  v_new_status := case p_decision
    when 'approve' then case v_record.submitted_type
      when 'represented' then 'represented'
      else 'present'
    end
    when 'deny' then 'absent'
    when 'present' then 'present'
    when 'absent' then 'absent'
    when 'excused' then 'excused'
    else null
  end;

  if v_new_status is null then
    raise exception 'Invalid attendance decision' using errcode = '22023';
  end if;
  if p_decision in ('approve', 'deny') and v_record.status <> 'pending' then
    raise exception 'Only pending submissions can be agreed or denied' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_note, ''))) > 500 then
    raise exception 'Administrative note is too long' using errcode = '22023';
  end if;

  update public.attendance_records
  set status = v_new_status,
      reviewed_by = v_user,
      reviewed_at = now(),
      administrative_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_record_id
  returning * into v_record;

  perform public.write_audit('attendance_' || p_decision, 'attendance_records', p_record_id::text,
    jsonb_build_object('previous_status', v_previous, 'new_status', v_new_status,
      'note', nullif(btrim(coalesce(p_note, '')), '')));

  return query select * from public.attendance_records where id = p_record_id;
end;
$$;

create or replace function public.admin_finalise_attendance(
  p_session_id uuid,
  p_remaining_status text default 'absent'
)
returns setof public.attendance_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_updated integer;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if p_remaining_status not in ('absent', 'excused') then
    raise exception 'Remaining students can only be marked absent or excused' using errcode = '22023';
  end if;

  select status into v_status from public.attendance_sessions where id = p_session_id for update;
  if v_status is distinct from 'closed' then
    raise exception 'Session must be closed before finalisation' using errcode = '23514';
  end if;

  update public.attendance_records
  set status = p_remaining_status,
      reviewed_by = v_user,
      reviewed_at = now(),
      administrative_note = 'Finalised by PE administrator'
  where session_id = p_session_id and status = 'not_submitted';
  get diagnostics v_updated = row_count;

  update public.attendance_sessions
  set status = 'finalised', finalised_at = now(), finalised_by = v_user
  where id = p_session_id;

  perform public.write_audit('attendance_finalised', 'attendance_sessions', p_session_id::text,
    jsonb_build_object('remaining_status', p_remaining_status, 'remaining_students', v_updated));

  return query select * from public.attendance_records where session_id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trusted RPCs — tasks and files
-- ---------------------------------------------------------------------------

create or replace function public.admin_save_class_task(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_starts_at timestamptz,
  p_due_at timestamptz,
  p_priority text,
  p_instructions text,
  p_submission_requirements text,
  p_allow_text boolean,
  p_allow_files boolean,
  p_allow_links boolean,
  p_max_file_size_bytes integer,
  p_allowed_file_types text[],
  p_max_files integer,
  p_status text,
  p_audiences jsonb
)
returns setof public.class_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_task public.class_tasks;
  v_audience jsonb;
  v_type text;
  v_dept uuid;
  v_sem smallint;
  v_student uuid;
  v_existing boolean;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'Task title is required' using errcode = '22023';
  end if;
  if p_due_at <= p_starts_at then
    raise exception 'Deadline must be after the start date' using errcode = '22023';
  end if;
  if p_status not in ('draft', 'published', 'closed', 'archived') then
    raise exception 'Invalid task status' using errcode = '22023';
  end if;
  if p_max_files not between 0 and 10 or p_max_file_size_bytes <= 0 then
    raise exception 'Invalid file attachment settings' using errcode = '22023';
  end if;
  if jsonb_typeof(p_audiences) <> 'array' or jsonb_array_length(p_audiences) = 0 then
    raise exception 'Select at least one target audience' using errcode = '22023';
  end if;

  select exists(select 1 from public.class_tasks where id = p_task_id) into v_existing;

  if v_existing then
    update public.class_tasks
    set title = btrim(p_title), description = coalesce(p_description, ''),
        category = coalesce(nullif(btrim(p_category), ''), 'general'),
        starts_at = p_starts_at, due_at = p_due_at,
        priority = case when p_priority in ('low', 'normal', 'high') then p_priority else 'normal' end,
        instructions = nullif(btrim(coalesce(p_instructions, '')), ''),
        submission_requirements = nullif(btrim(coalesce(p_submission_requirements, '')), ''),
        allow_text = p_allow_text, allow_files = p_allow_files, allow_links = p_allow_links,
        max_file_size_bytes = p_max_file_size_bytes,
        allowed_file_types = p_allowed_file_types, max_files = p_max_files,
        status = p_status,
        published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
    where id = p_task_id
    returning * into v_task;
    delete from public.task_audiences where task_id = p_task_id;
  else
    insert into public.class_tasks (
      title, description, category, starts_at, due_at, priority, instructions,
      submission_requirements, allow_text, allow_files, allow_links,
      max_file_size_bytes, allowed_file_types, max_files, status,
      created_by, published_at
    )
    values (
      btrim(p_title), coalesce(p_description, ''),
      coalesce(nullif(btrim(p_category), ''), 'general'),
      p_starts_at, p_due_at,
      case when p_priority in ('low', 'normal', 'high') then p_priority else 'normal' end,
      nullif(btrim(coalesce(p_instructions, '')), ''),
      nullif(btrim(coalesce(p_submission_requirements, '')), ''),
      p_allow_text, p_allow_files, p_allow_links,
      p_max_file_size_bytes, p_allowed_file_types, p_max_files, p_status, v_user,
      case when p_status = 'published' then now() else null end
    )
    returning * into v_task;
  end if;

  for v_audience in select value from jsonb_array_elements(p_audiences) loop
    v_type := v_audience ->> 'audience_type';
    if v_type not in ('all_students', 'active_pe', 'department', 'semester', 'selected_students') then
      raise exception 'Invalid audience type' using errcode = '22023';
    end if;
    v_dept := nullif(v_audience ->> 'department_id', '')::uuid;
    v_sem := nullif(v_audience ->> 'semester', '')::smallint;
    v_student := nullif(v_audience ->> 'student_directory_id', '')::uuid;

    insert into public.task_audiences (task_id, audience_type, department_id, semester, student_directory_id)
    values (v_task.id, v_type, v_dept, v_sem, v_student);
  end loop;

  perform public.write_audit(
    case when v_existing then 'class_task_updated' else 'class_task_created' end,
    'class_tasks', v_task.id::text,
    jsonb_build_object('title', v_task.title, 'status', v_task.status, 'due_at', v_task.due_at,
      'audiences', p_audiences)
  );

  return query select * from public.class_tasks where id = v_task.id;
end;
$$;

create or replace function public.student_save_task_submission(
  p_task_id uuid,
  p_text_content text,
  p_link_url text,
  p_submit boolean default true
)
returns setof public.task_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_directory uuid;
  v_task public.class_tasks;
  v_submission public.task_submissions;
  v_action text;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.student_matches_task(p_task_id, v_user) then
    raise exception 'This task is not assigned to you' using errcode = '42501';
  end if;

  select * into v_task from public.class_tasks where id = p_task_id for update;
  if v_task.status <> 'published' then
    raise exception 'Task is not accepting submissions' using errcode = '23514';
  end if;
  if p_submit and now() > v_task.due_at then
    raise exception 'Submission deadline has passed' using errcode = '23514';
  end if;
  if p_submit and not (v_task.allow_text or v_task.allow_files or v_task.allow_links) then
    raise exception 'Task has no submission method' using errcode = '23514';
  end if;
  if btrim(coalesce(p_text_content, '')) <> '' and not v_task.allow_text then
    raise exception 'Text submissions are not allowed' using errcode = '23514';
  end if;
  if btrim(coalesce(p_link_url, '')) <> '' and not v_task.allow_links then
    raise exception 'Link submissions are not allowed' using errcode = '23514';
  end if;

  v_directory := public.student_directory_id_for_user(v_user);

  select * into v_submission
  from public.task_submissions
  where task_id = p_task_id and student_directory_id = v_directory
  for update;

  if found and v_submission.status in ('reviewed', 'completed') then
    raise exception 'Reviewed submissions cannot be edited' using errcode = '23514';
  end if;
  if found and v_submission.status = 'submitted' and now() > v_task.due_at then
    raise exception 'Submission deadline has passed' using errcode = '23514';
  end if;

  v_action := case when found then 'task_submission_updated' else 'task_submission_created' end;

  insert into public.task_submissions (
    task_id, student_directory_id, user_id, status, text_content, link_url, submitted_at
  )
  values (
    p_task_id, v_directory, v_user,
    case when p_submit then 'submitted' else 'pending' end,
    nullif(btrim(coalesce(p_text_content, '')), ''),
    nullif(btrim(coalesce(p_link_url, '')), ''),
    case when p_submit then now() else null end
  )
  on conflict (task_id, student_directory_id) do update
  set status = case when p_submit then 'submitted' else 'pending' end,
      text_content = nullif(btrim(coalesce(p_text_content, '')), ''),
      link_url = nullif(btrim(coalesce(p_link_url, '')), ''),
      submitted_at = case when p_submit then coalesce(public.task_submissions.submitted_at, now()) else null end,
      updated_at = now()
  returning * into v_submission;

  insert into public.task_submission_history (submission_id, actor_id, action, details)
  values (v_submission.id, v_user, v_action,
    jsonb_build_object('submit', p_submit, 'has_text', btrim(coalesce(p_text_content, '')) <> '',
      'has_link', btrim(coalesce(p_link_url, '')) <> ''));

  return query select * from public.task_submissions where id = v_submission.id;
end;
$$;

create or replace function public.admin_review_task_submission(
  p_submission_id uuid,
  p_status text,
  p_feedback text default null
)
returns setof public.task_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_submission public.task_submissions;
  v_previous text;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('reviewed', 'needs_correction', 'completed') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  select * into v_submission from public.task_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = '22023';
  end if;
  v_previous := v_submission.status;

  update public.task_submissions
  set status = p_status,
      reviewed_by = v_user, reviewed_at = now(),
      feedback = nullif(btrim(coalesce(p_feedback, '')), '')
  where id = p_submission_id
  returning * into v_submission;

  insert into public.task_submission_history (submission_id, actor_id, action, details)
  values (p_submission_id, v_user, 'task_submission_reviewed',
    jsonb_build_object('previous_status', v_previous, 'new_status', p_status,
      'feedback', nullif(btrim(coalesce(p_feedback, '')), '')));

  perform public.write_audit('task_submission_reviewed', 'task_submissions', p_submission_id::text,
    jsonb_build_object('previous_status', v_previous, 'new_status', p_status));

  return query select * from public.task_submissions where id = p_submission_id;
end;
$$;

-- Request upload authorisation. Only metadata is created; no object is trusted
-- until confirm_file_upload() verifies the real object through the storage SDK.
create or replace function public.create_file_upload(
  p_parent_type text,
  p_parent_id uuid,
  p_original_filename text,
  p_content_type text,
  p_byte_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_task public.class_tasks;
  v_submission public.task_submissions;
  v_directory uuid;
  v_object_key text;
  v_file_id uuid;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_original_filename, '')) = '' or length(p_original_filename) > 255 then
    raise exception 'Invalid filename' using errcode = '22023';
  end if;
  if p_byte_size <= 0 then
    raise exception 'Invalid file size' using errcode = '22023';
  end if;

  if p_parent_type = 'task_reference' then
    if not public.is_pe_admin(v_user) then
      raise exception 'PE administrator access required' using errcode = '42501';
    end if;
    select * into v_task from public.class_tasks where id = p_parent_id;
    if not found then raise exception 'Task not found' using errcode = '22023'; end if;
    select count(*) into v_count from public.stored_files
    where parent_type = 'task_reference' and parent_id = p_parent_id and upload_status = 'confirmed';
    if v_count >= 10 then raise exception 'Attachment limit reached' using errcode = '23514'; end if;
  elsif p_parent_type = 'task_submission' then
    v_directory := public.student_directory_id_for_user(v_user);
    select s.* into v_submission
    from public.task_submissions s where s.id = p_parent_id and s.student_directory_id = v_directory;
    if not found then raise exception 'Submission not found or not owned by you' using errcode = '42501'; end if;
    select * into v_task from public.class_tasks where id = v_submission.task_id;
    if v_task.status <> 'published' then raise exception 'Task is not accepting files' using errcode = '23514'; end if;
    if now() > v_task.due_at then raise exception 'Submission deadline has passed' using errcode = '23514'; end if;
    select count(*) into v_count from public.stored_files
    where parent_type = 'task_submission' and parent_id = p_parent_id and upload_status = 'confirmed';
    if v_count >= v_task.max_files then raise exception 'Attachment limit reached' using errcode = '23514'; end if;
  else
    raise exception 'Invalid file parent type' using errcode = '22023';
  end if;

  if p_byte_size > v_task.max_file_size_bytes then
    raise exception 'File exceeds the task size limit' using errcode = '22023';
  end if;

  v_object_key := v_task.id::text || '/' || coalesce(p_parent_type, 'file') || '/' ||
    p_parent_id::text || '/' || replace(gen_random_uuid()::text, '-', '') || '/' ||
    regexp_replace(lower(btrim(p_original_filename)), '[^a-z0-9._-]+', '-', 'g');

  insert into public.stored_files (
    object_key, bucket, original_filename, content_type, byte_size,
    uploader_id, parent_type, parent_id, upload_status
  )
  values (
    v_object_key, 'r2', left(btrim(p_original_filename), 255), btrim(p_content_type), p_byte_size,
    v_user, p_parent_type, p_parent_id, 'pending'
  )
  returning id into v_file_id;

  return jsonb_build_object('file_id', v_file_id, 'object_key', v_object_key,
    'bucket', 'r2', 'max_bytes', v_task.max_file_size_bytes);
end;
$$;

create or replace function public.confirm_file_upload(
  p_file_id uuid,
  p_verified_size bigint,
  p_verified_content_type text
)
returns setof public.stored_files
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_file public.stored_files;
  v_task public.class_tasks;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_file from public.stored_files where id = p_file_id for update;
  if not found or v_file.uploader_id <> v_user then
    raise exception 'Upload not found or not owned by you' using errcode = '42501';
  end if;
  if v_file.upload_status <> 'pending' then
    raise exception 'Upload has already been finalised' using errcode = '23514';
  end if;

  if p_verified_size <= 0 or p_verified_size > v_file.byte_size then
    raise exception 'Uploaded object size does not match the authorised upload' using errcode = '22023';
  end if;

  if v_file.parent_type = 'task_reference' then
    select * into v_task from public.class_tasks where id = v_file.parent_id;
  else
    select t.* into v_task from public.class_tasks t
    join public.task_submissions s on s.task_id = t.id where s.id = v_file.parent_id;
  end if;
  if not found then
    raise exception 'Task for this upload was not found' using errcode = '22023';
  end if;
  if v_task.max_file_size_bytes is not null
      and p_verified_size > v_task.max_file_size_bytes then
    raise exception 'File exceeds the task size limit' using errcode = '22023';
  end if;

  update public.stored_files
  set byte_size = p_verified_size,
      content_type = coalesce(nullif(btrim(p_verified_content_type), ''), v_file.content_type),
      upload_status = 'confirmed'
  where id = p_file_id
  returning * into v_file;

  perform public.write_audit('file_upload_confirmed', 'stored_files', p_file_id::text,
    jsonb_build_object('parent_type', v_file.parent_type, 'parent_id', v_file.parent_id,
      'byte_size', v_file.byte_size));

  return query select * from public.stored_files where id = p_file_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trusted RPCs — visitors, rooms and QR
-- ---------------------------------------------------------------------------

create or replace function public.submit_visitor_entry(
  p_token text,
  p_full_name text,
  p_usn text,
  p_department_id uuid,
  p_academic_year smallint,
  p_semester smallint,
  p_purpose_id uuid,
  p_purpose_detail text,
  p_description text,
  p_bot_check_passed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_qr public.qr_codes;
  v_purpose public.visitor_purposes;
  v_profile public.profiles;
  v_directory public.student_directory;
  v_directory_id uuid;
  v_visitor uuid;
  v_name text;
  v_usn text;
  v_dept uuid;
  v_year smallint;
  v_sem smallint;
  v_identity text;
  v_visited timestamptz := now();
begin
  select * into v_qr from public.qr_codes
  where token = p_token and qr_type = 'visitor_entrance' and is_active;
  if not found then
    raise exception 'This visitor QR code is invalid or inactive' using errcode = '42501';
  end if;
  if not coalesce(p_bot_check_passed, false) then
    raise exception 'Automated submission was rejected' using errcode = '42501';
  end if;

  select * into v_purpose from public.visitor_purposes
  where id = p_purpose_id and is_active;
  if not found then
    raise exception 'Select a valid purpose of visit' using errcode = '22023';
  end if;
  if lower(v_purpose.label) = 'other' and btrim(coalesce(p_purpose_detail, '')) = '' then
    raise exception 'Describe your purpose of visit' using errcode = '22023';
  end if;

  if v_user is not null then
    select * into v_profile from public.profiles where id = v_user and account_status = 'active';
    if not found then
      raise exception 'Account is not active' using errcode = '42501';
    end if;
    v_identity := 'authenticated_profile';
    v_name := v_profile.full_name;
    if v_profile.student_directory_id is not null then
      select * into v_directory from public.student_directory
      where id = v_profile.student_directory_id and is_active;
      if found then
        v_directory_id := v_directory.id;
        v_usn := v_directory.usn;
        v_dept := v_directory.department_id;
        v_year := v_directory.academic_year;
        v_sem := v_directory.semester;
      end if;
    end if;
  else
    v_identity := 'guest_input';
    v_name := btrim(coalesce(p_full_name, ''));
    if length(v_name) < 2 or length(v_name) > 120 then
      raise exception 'Enter your full name' using errcode = '22023';
    end if;
    v_usn := nullif(upper(regexp_replace(btrim(coalesce(p_usn, '')), '[\s\-_/.]+', '', 'g')), '');
    if v_usn is not null and v_usn !~ '^[A-Z0-9]{6,24}$' then
      raise exception 'Enter a valid USN' using errcode = '22023';
    end if;
    if p_academic_year is not null and p_academic_year not between 1 and 6 then
      raise exception 'Invalid academic year' using errcode = '22023';
    end if;
    if p_semester is not null and p_semester not between 1 and 12 then
      raise exception 'Invalid semester' using errcode = '22023';
    end if;
    v_dept := p_department_id;
    v_year := p_academic_year;
    v_sem := p_semester;
  end if;

  insert into public.visitor_records (
    qr_code_id, visitor_user_id, student_directory_id, full_name, usn,
    department_id, academic_year, semester, purpose_id, purpose_detail,
    description, identity_source, bot_check_passed, visited_at
  )
  values (
    v_qr.id, v_user, v_directory_id, v_name, v_usn,
    v_dept, v_year, v_sem, v_purpose.id,
    nullif(btrim(coalesce(p_purpose_detail, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    v_identity, coalesce(p_bot_check_passed, false), v_visited
  )
  returning id into v_visitor;

  return jsonb_build_object('id', v_visitor, 'visited_at', v_visited,
    'display_name', v_name, 'purpose', v_purpose.label);
end;
$$;

-- Restricted public projection for the "Today's Visitors" board. No USN,
-- email, user id, department or private identifier is returned.
create or replace function public.get_today_visitors()
returns table (visitor_label text, purpose_label text, visited_at timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    case
      when btrim(coalesce(v.full_name, '')) = '' then 'Visitor'
      when array_length(string_to_array(btrim(v.full_name), ' '), 1) = 1 then split_part(btrim(v.full_name), ' ', 1)
      else split_part(btrim(v.full_name), ' ', 1) || ' ' || left(reverse(split_part(reverse(btrim(v.full_name)), ' ', 1)), 1) || '.'
    end,
    p.label,
    v.visited_at
  from public.visitor_records v
  join public.visitor_purposes p on p.id = v.purpose_id
  where v.visited_at >= public.ist_day_start()
    and v.visited_at < public.ist_day_end()
  order by v.visited_at desc
  limit 200;
$$;

create or replace function public.admin_correct_visitor_record(
  p_visitor_id uuid,
  p_reason text
)
returns setof public.visitor_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_record public.visitor_records;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A correction reason is required' using errcode = '22023';
  end if;
  select * into v_record from public.visitor_records where id = p_visitor_id for update;
  if not found then raise exception 'Visitor record not found' using errcode = '22023'; end if;

  perform public.write_audit('visitor_record_corrected', 'visitor_records', p_visitor_id::text,
    jsonb_build_object('reason', left(btrim(p_reason), 500),
      'previous_visited_at', v_record.visited_at, 'previous_purpose_id', v_record.purpose_id));

  return query select * from public.visitor_records where id = p_visitor_id;
end;
$$;

create or replace function public.student_enter_room(
  p_token text,
  p_activity_id uuid default null
)
returns setof public.room_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_qr public.qr_codes;
  v_room public.pe_rooms;
  v_activity public.room_activities;
  v_activity_name text;
  v_directory uuid;
  v_session public.room_sessions;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.is_active_pe_student(v_user) then
    raise exception 'Active PE membership is required for room access' using errcode = '42501';
  end if;

  select q.* into v_qr from public.qr_codes q
  where q.token = p_token and q.is_active and q.qr_type in ('playing_room', 'gym_room', 'mental_games_room');
  if not found then raise exception 'This room QR code is invalid or inactive' using errcode = '42501'; end if;
  select * into v_room from public.pe_rooms where id = v_qr.room_id and is_active;
  if not found then raise exception 'This room is not active' using errcode = '23514'; end if;

  v_directory := public.student_directory_id_for_user(v_user);
  if exists (
    select 1 from public.room_sessions
    where room_id = v_room.id and student_directory_id = v_directory and ended_at is null
  ) then
    raise exception 'You already have an active session in this room' using errcode = '23505';
  end if;

  if v_room.requires_activity then
    if p_activity_id is null then
      raise exception 'Choose an activity before entering' using errcode = '22023';
    end if;
    select * into v_activity from public.room_activities
    where id = p_activity_id and room_id = v_room.id and is_active;
    if not found then raise exception 'Invalid activity for this room' using errcode = '22023'; end if;
    v_activity_name := v_activity.name;
  end if;

  insert into public.room_sessions (room_id, user_id, student_directory_id, activity_id, activity_name, started_at)
  values (v_room.id, v_user, v_directory, p_activity_id, v_activity_name, now())
  returning * into v_session;

  perform public.write_audit('room_session_started', 'room_sessions', v_session.id::text,
    jsonb_build_object('room_id', v_room.id, 'activity', v_activity_name));

  return query select * from public.room_sessions where id = v_session.id;
end;
$$;

create or replace function public.student_exit_room(p_token text)
returns setof public.room_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_qr public.qr_codes;
  v_directory uuid;
  v_session public.room_sessions;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select q.* into v_qr from public.qr_codes q
  where q.token = p_token and q.is_active and q.qr_type in ('playing_room', 'gym_room', 'mental_games_room');
  if not found then raise exception 'This room QR code is invalid or inactive' using errcode = '42501'; end if;

  v_directory := public.student_directory_id_for_user(v_user);
  select s.* into v_session from public.room_sessions s
  where s.room_id = v_qr.room_id and s.student_directory_id = v_directory and s.ended_at is null
  for update;
  if not found then raise exception 'No active room session was found' using errcode = '22023'; end if;

  update public.room_sessions set ended_at = now() where id = v_session.id returning * into v_session;
  perform public.write_audit('room_session_ended', 'room_sessions', v_session.id::text,
    jsonb_build_object('room_id', v_qr.room_id, 'duration_seconds',
      extract(epoch from (v_session.ended_at - v_session.started_at))::integer));

  return query select * from public.room_sessions where id = v_session.id;
end;
$$;

create or replace function public.admin_close_room_session(
  p_session_id uuid,
  p_reason text
)
returns setof public.room_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.room_sessions;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required to close a session' using errcode = '22023';
  end if;
  select * into v_session from public.room_sessions where id = p_session_id for update;
  if not found then raise exception 'Room session not found' using errcode = '22023'; end if;
  if v_session.ended_at is not null then
    raise exception 'Room session is already closed' using errcode = '23514';
  end if;

  update public.room_sessions
  set ended_at = now(), force_closed_by = v_user,
      force_closed_reason = left(btrim(p_reason), 500)
  where id = p_session_id
  returning * into v_session;

  perform public.write_audit('room_session_forced_closed', 'room_sessions', p_session_id::text,
    jsonb_build_object('reason', left(btrim(p_reason), 500),
      'started_at', v_session.started_at, 'ended_at', v_session.ended_at));

  return query select * from public.room_sessions where id = p_session_id;
end;
$$;

-- Limited, server-controlled QR resolution. Raw management fields are never
-- returned to the public caller.
create or replace function public.resolve_qr_token(p_token text)
returns table (
  qr_type text,
  destination_path text,
  room_code text,
  room_name text,
  requires_activity boolean,
  theme text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select q.qr_type, q.destination_path, r.code, r.name, r.requires_activity, q.theme
  from public.qr_codes q
  left join public.pe_rooms r on r.id = q.room_id
  where q.token = p_token and q.is_active;
$$;

create or replace function public.admin_set_qr_active(p_qr_id uuid, p_active boolean)
returns setof public.qr_codes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  update public.qr_codes set is_active = p_active where id = p_qr_id;
  if not found then raise exception 'QR code not found' using errcode = '22023'; end if;
  perform public.write_audit(
    case when p_active then 'qr_activated' else 'qr_deactivated' end,
    'qr_codes', p_qr_id::text, jsonb_build_object('active', p_active)
  );
  return query select * from public.qr_codes where id = p_qr_id;
end;
$$;

-- Regeneration replaces the token in place, immediately invalidating the old QR.
create or replace function public.admin_regenerate_qr(p_qr_id uuid)
returns setof public.qr_codes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  update public.qr_codes
  set token = public.new_qr_token(), is_active = true
  where id = p_qr_id;
  if not found then raise exception 'QR code not found' using errcode = '22023'; end if;
  perform public.write_audit('qr_regenerated', 'qr_codes', p_qr_id::text,
    jsonb_build_object('reason', 'Previous token invalidated'));
  return query select * from public.qr_codes where id = p_qr_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — every exposed Phase 2 table is explicitly enabled
-- ---------------------------------------------------------------------------

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.class_tasks enable row level security;
alter table public.task_audiences enable row level security;
alter table public.task_submissions enable row level security;
alter table public.task_submission_history enable row level security;
alter table public.stored_files enable row level security;
alter table public.visitor_purposes enable row level security;
alter table public.visitor_records enable row level security;
alter table public.pe_rooms enable row level security;
alter table public.room_activities enable row level security;
alter table public.room_sessions enable row level security;
alter table public.qr_codes enable row level security;

-- Public configuration reads needed by the visitor form (additive to Phase 1).
create policy "departments_public_active_read"
  on public.departments for select to anon
  using (is_active);

create policy "attendance_sessions_admin_all"
  on public.attendance_sessions for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "attendance_sessions_active_pe_read"
  on public.attendance_sessions for select to authenticated
  using (
    public.is_active_pe_student()
    and status in ('open', 'closed', 'finalised')
  );

create policy "attendance_records_admin_all"
  on public.attendance_records for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "attendance_records_own_read"
  on public.attendance_records for select to authenticated
  using (
    public.is_active_pe_student()
    and student_directory_id = public.student_directory_id_for_user()
  );

create policy "class_tasks_admin_all"
  on public.class_tasks for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "class_tasks_eligible_student_read"
  on public.class_tasks for select to authenticated
  using (
    status = 'published'
    and public.student_matches_task(id)
  );

create policy "task_audiences_admin_read"
  on public.task_audiences for select to authenticated
  using (public.is_pe_admin());

create policy "task_submissions_admin_all"
  on public.task_submissions for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "task_submissions_own_read"
  on public.task_submissions for select to authenticated
  using (user_id = auth.uid());

create policy "task_history_admin_read"
  on public.task_submission_history for select to authenticated
  using (public.is_pe_admin());

create policy "task_history_own_read"
  on public.task_submission_history for select to authenticated
  using (
    exists (
      select 1 from public.task_submissions s
      where s.id = submission_id and s.user_id = auth.uid()
    )
  );

create policy "stored_files_admin_all"
  on public.stored_files for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "stored_files_uploader_read"
  on public.stored_files for select to authenticated
  using (uploader_id = auth.uid());

create policy "stored_files_task_reference_read"
  on public.stored_files for select to authenticated
  using (
    parent_type = 'task_reference'
    and upload_status = 'confirmed'
    and exists (
      select 1 from public.class_tasks t
      where t.id = parent_id and t.status = 'published'
        and public.student_matches_task(t.id)
    )
  );

create policy "visitor_purposes_anon_active_read"
  on public.visitor_purposes for select to anon
  using (is_active);

create policy "visitor_purposes_authenticated_read"
  on public.visitor_purposes for select to authenticated
  using (is_active or public.is_pe_admin());

create policy "visitor_purposes_admin_all"
  on public.visitor_purposes for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

-- No public SELECT policy on visitor_records: full records are admin-only.
create policy "visitor_records_admin_all"
  on public.visitor_records for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "pe_rooms_admin_all"
  on public.pe_rooms for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "pe_rooms_active_pe_read"
  on public.pe_rooms for select to authenticated
  using (is_active and public.is_active_pe_student());

create policy "room_activities_admin_all"
  on public.room_activities for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "room_activities_active_pe_read"
  on public.room_activities for select to authenticated
  using (
    is_active and public.is_active_pe_student()
    and exists (select 1 from public.pe_rooms r where r.id = room_id and r.is_active)
  );

create policy "room_sessions_admin_all"
  on public.room_sessions for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

create policy "room_sessions_own_read"
  on public.room_sessions for select to authenticated
  using (user_id = auth.uid());

create policy "qr_codes_admin_all"
  on public.qr_codes for all to authenticated
  using (public.is_pe_admin()) with check (public.is_pe_admin());

-- ---------------------------------------------------------------------------
-- Grants — RLS still applies to every table. Writes go through audited RPCs.
-- ---------------------------------------------------------------------------

revoke all on public.attendance_sessions, public.attendance_records,
  public.class_tasks, public.task_audiences, public.task_submissions,
  public.task_submission_history, public.stored_files, public.visitor_purposes,
  public.visitor_records, public.pe_rooms, public.room_activities,
  public.room_sessions, public.qr_codes from anon, authenticated;

grant select on public.attendance_sessions, public.attendance_records,
  public.class_tasks, public.task_audiences, public.task_submissions,
  public.task_submission_history, public.stored_files, public.pe_rooms,
  public.room_activities, public.room_sessions, public.qr_codes to authenticated;
grant select on public.visitor_purposes to anon, authenticated;
grant select, insert, update, delete on public.visitor_purposes to authenticated;

revoke all on function public.ist_day_start(date) from public;
revoke all on function public.ist_day_end(date) from public;
-- This SECURITY DEFINER helper is called by the RLS policies above as the
-- authenticated invoker; keep it revoked from PUBLIC and grant only to
-- authenticated (below). Removing EXECUTE entirely breaks attendance reads.
revoke all on function public.student_directory_id_for_user(uuid) from public, anon;
revoke all on function public.is_active_pe_student(uuid) from public;
revoke all on function public.student_matches_task(uuid, uuid) from public;
revoke all on function public.write_audit(text, text, text, jsonb) from public;
revoke all on function public.admin_log_action(text, text, text, jsonb) from public;
revoke all on function public.new_qr_token() from public;

grant execute on function public.student_directory_id_for_user(uuid) to authenticated;
grant execute on function public.is_active_pe_student(uuid) to authenticated;
grant execute on function public.student_matches_task(uuid, uuid) to authenticated;
grant execute on function public.submit_visitor_entry(text, text, text, uuid, smallint, smallint, uuid, text, text, boolean) to anon, authenticated;
grant execute on function public.get_today_visitors() to anon, authenticated;
grant execute on function public.resolve_qr_token(text) to anon, authenticated;
grant execute on function public.student_submit_attendance(uuid, text) to authenticated;
grant execute on function public.student_save_task_submission(uuid, text, text, boolean) to authenticated;
grant execute on function public.create_file_upload(text, uuid, text, text, bigint) to authenticated;
grant execute on function public.confirm_file_upload(uuid, bigint, text) to authenticated;
grant execute on function public.student_enter_room(text, uuid) to authenticated;
grant execute on function public.student_exit_room(text) to authenticated;
grant execute on function public.admin_create_attendance_session(text, date, timestamptz, timestamptz, text, boolean, text) to authenticated;
grant execute on function public.admin_set_attendance_session_status(uuid, text) to authenticated;
grant execute on function public.admin_review_attendance(uuid, text, text) to authenticated;
grant execute on function public.admin_finalise_attendance(uuid, text) to authenticated;
grant execute on function public.admin_save_class_task(uuid, text, text, text, timestamptz, timestamptz, text, text, text, boolean, boolean, boolean, integer, text[], integer, text, jsonb) to authenticated;
grant execute on function public.admin_review_task_submission(uuid, text, text) to authenticated;
grant execute on function public.admin_correct_visitor_record(uuid, text) to authenticated;
grant execute on function public.admin_close_room_session(uuid, text) to authenticated;
grant execute on function public.admin_set_qr_active(uuid, boolean) to authenticated;
grant execute on function public.admin_regenerate_qr(uuid) to authenticated;
grant execute on function public.admin_log_action(text, text, text, jsonb) to authenticated;

-- Supabase Realtime: only authorised subscribers receive changes because the
-- tables above have RLS policies for authenticated users.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'attendance_records'
    ) then
      alter publication supabase_realtime add table public.attendance_records;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'room_sessions'
    ) then
      alter publication supabase_realtime add table public.room_sessions;
    end if;
  end if;
end $$;
