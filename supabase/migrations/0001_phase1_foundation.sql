-- ============================================================================
-- Phase 1 — Core foundation, authentication, students and dashboards
-- Apply this migration once with the Supabase SQL editor or the Supabase CLI.
-- This migration is additive: it never drops existing tables or data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_usn(p_usn text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select upper(regexp_replace(btrim(p_usn), '[\s\-_/.]+', '', 'g'));
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Roles are stored in a table; this definer function prevents recursive RLS
-- evaluation when a policy needs to know whether the caller is a PE admin.
create or replace function public.is_pe_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = 'pe_admin'
  );
$$;

create or replace function public.has_role(
  p_role text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = p_role
  );
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  department_code text not null,
  department_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_code_format check (
    department_code = upper(btrim(department_code)) and department_code ~ '^[A-Z0-9]{2,12}$'
  ),
  constraint departments_name_not_blank check (btrim(department_name) <> '')
);

create unique index departments_code_uidx
  on public.departments (department_code);

create table public.student_directory (
  id uuid primary key default gen_random_uuid(),
  usn text not null,
  full_name text not null,
  department_id uuid not null
    references public.departments (id) on update cascade on delete restrict,
  academic_year smallint not null check (academic_year between 1 and 6),
  semester smallint not null check (semester between 1 and 12),
  official_email text,
  is_active boolean not null default true,
  source text not null default 'manual'
    check (source in ('manual', 'import', 'registration')),
  source_import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_directory_usn_format check (
    usn = public.normalize_usn(usn) and usn ~ '^[A-Z0-9]{6,24}$'
  ),
  constraint student_directory_name_not_blank check (btrim(full_name) <> ''),
  constraint student_directory_email_format check (
    official_email is null or official_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create unique index student_directory_usn_uidx
  on public.student_directory (usn);

create unique index student_directory_email_uidx
  on public.student_directory (lower(official_email))
  where official_email is not null;

create index student_directory_department_idx
  on public.student_directory (department_id);

create index student_directory_semester_idx
  on public.student_directory (semester);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  student_directory_id uuid unique
    references public.student_directory (id) on delete set null,
  requested_usn text not null check (requested_usn = public.normalize_usn(requested_usn)),
  full_name text not null check (btrim(full_name) <> ''),
  email text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'suspended')),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_requested_usn_uidx
  on public.profiles (requested_usn);
create index profiles_verification_idx on public.profiles (verification_status);
create index profiles_created_idx on public.profiles (created_at desc);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'pe_admin', 'event_organizer')),
  created_at timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

create table public.pe_memberships (
  id uuid primary key default gen_random_uuid(),
  student_directory_id uuid not null
    references public.student_directory (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  added_by uuid references auth.users (id) on delete set null,
  removed_by uuid references auth.users (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pe_membership_valid_period check (
    (status = 'active' and ended_at is null) or
    (status = 'inactive' and ended_at is not null)
  )
);

-- Only one active membership per official student; earlier memberships remain
-- as history when a student is removed and later reactivated.
create unique index pe_memberships_one_active_idx
  on public.pe_memberships (student_directory_id) where status = 'active';

create index pe_memberships_status_idx on public.pe_memberships (status);
create index pe_memberships_student_idx on public.pe_memberships (student_directory_id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_by uuid references auth.users (id) on delete set null,
  total_rows integer not null check (total_rows >= 0),
  inserted_rows integer not null default 0 check (inserted_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index import_batches_created_idx on public.import_batches (created_at desc);

alter table public.student_directory
  add column source_import_batch_id uuid
    references public.import_batches (id) on delete set null;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: normalisation, timestamps, audit trail
-- ---------------------------------------------------------------------------

create or replace function public.normalize_department_code()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.department_code := upper(btrim(new.department_code));
  new.department_name := btrim(new.department_name);
  return new;
end;
$$;

create or replace function public.normalize_student_usn()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.usn := public.normalize_usn(new.usn);
  new.full_name := btrim(new.full_name);
  if new.official_email is not null then
    new.official_email := lower(btrim(new.official_email));
  end if;
  return new;
end;
$$;

create trigger departments_normalize
  before insert or update on public.departments
  for each row execute function public.normalize_department_code();

create trigger student_directory_normalize
  before insert or update on public.student_directory
  for each row execute function public.normalize_student_usn();

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

create trigger student_directory_set_updated_at
  before update on public.student_directory
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger pe_memberships_set_updated_at
  before update on public.pe_memberships
  for each row execute function public.set_updated_at();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_id text;
begin
  if tg_op = 'DELETE' then
    v_target_id := to_jsonb(old) ->> 'id';
  else
    v_target_id := to_jsonb(new) ->> 'id';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    tg_table_name || '_' || lower(tg_op),
    tg_table_name,
    v_target_id,
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger departments_audit
  after insert or update or delete on public.departments
  for each row execute function public.audit_row_change();

create trigger student_directory_audit
  after insert or update or delete on public.student_directory
  for each row execute function public.audit_row_change();

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change();

create trigger pe_memberships_audit
  after insert or update or delete on public.pe_memberships
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Privileged RPCs — each one checks the caller's role again in the database
-- ---------------------------------------------------------------------------

-- Students may only change their own display name. Privileged fields cannot be
-- touched through the client because there is no UPDATE policy on profiles.
create or replace function public.update_my_profile(p_full_name text)
returns setof public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Full name is required' using errcode = '22023';
  end if;
  if length(btrim(p_full_name)) > 120 then
    raise exception 'Full name is too long' using errcode = '22023';
  end if;

  return query
    update public.profiles
    set full_name = btrim(p_full_name)
    where id = auth.uid()
    returning *;
end;
$$;

-- Adding, removing and reactivating PE membership is always a single trusted
-- operation, so duplicates and history are handled atomically in the database.
create or replace function public.admin_set_pe_membership(
  p_student_directory_id uuid,
  p_active boolean,
  p_notes text default null
)
returns setof public.pe_memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.student_directory
    where id = p_student_directory_id and is_active
  ) into v_exists;

  if not v_exists then
    raise exception 'Active student directory record not found' using errcode = '22023';
  end if;

  if p_active then
    if exists (
      select 1 from public.pe_memberships
      where student_directory_id = p_student_directory_id and status = 'active'
    ) then
      raise exception 'Student is already an active PE student' using errcode = '23505';
    end if;

    return query
      insert into public.pe_memberships (student_directory_id, status, added_by, notes)
      values (p_student_directory_id, 'active', v_user, nullif(btrim(coalesce(p_notes, '')), ''))
      returning *;
  else
    if not exists (
      select 1 from public.pe_memberships
      where student_directory_id = p_student_directory_id and status = 'active'
    ) then
      raise exception 'Student has no active PE membership' using errcode = '22023';
    end if;

    return query
      update public.pe_memberships
      set status = 'inactive',
          removed_by = v_user,
          ended_at = now(),
          notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
          updated_at = now()
      where student_directory_id = p_student_directory_id and status = 'active'
      returning *;
  end if;
end;
$$;

-- Directory import is atomic per batch; problem rows are recorded with their
-- original USN and a reason instead of partially updating the directory.
create or replace function public.admin_import_student_directory(
  p_rows jsonb,
  p_file_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_batch uuid;
  v_row jsonb;
  v_index integer := 0;
  v_usn text;
  v_name text;
  v_code text;
  v_year integer;
  v_semester integer;
  v_email text;
  v_department uuid;
  v_existing uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_total integer;
begin
  if not public.is_pe_admin(v_user) then
    raise exception 'PE administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be an array' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(p_rows);

  insert into public.import_batches (file_name, imported_by, total_rows)
  values (left(btrim(coalesce(p_file_name, 'import.csv')), 200), v_user, v_total)
  returning id into v_batch;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    begin
      v_usn := public.normalize_usn(coalesce(v_row ->> 'usn', ''));
      v_name := btrim(coalesce(v_row ->> 'full_name', ''));
      v_code := upper(btrim(coalesce(v_row ->> 'department_code', '')));
      v_year := nullif(btrim(coalesce(v_row ->> 'academic_year', '')), '')::integer;
      v_semester := nullif(btrim(coalesce(v_row ->> 'semester', '')), '')::integer;
      v_email := nullif(lower(btrim(coalesce(v_row ->> 'official_email', ''))), '');

      if v_usn !~ '^[A-Z0-9]{6,24}$' then
        raise exception 'Invalid USN' using errcode = '22023';
      end if;
      if length(v_name) < 2 or length(v_name) > 120 then
        raise exception 'Invalid full name' using errcode = '22023';
      end if;
      if v_year is null or v_year not between 1 and 6 then
        raise exception 'Academic year must be 1-6' using errcode = '22023';
      end if;
      if v_semester is null or v_semester not between 1 and 12 then
        raise exception 'Semester must be 1-12' using errcode = '22023';
      end if;
      if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'Invalid official email' using errcode = '22023';
      end if;

      select id into v_department
      from public.departments
      where department_code = v_code and is_active;

      if v_department is null then
        raise exception 'Unknown or inactive department code' using errcode = '22023';
      end if;

      select id into v_existing
      from public.student_directory
      where usn = v_usn;

      if v_existing is not null then
        raise exception 'Duplicate USN' using errcode = '23505';
      end if;

      insert into public.student_directory (
        usn, full_name, department_id, academic_year, semester,
        official_email, source, source_import_batch_id
      )
      values (
        v_usn, v_name, v_department, v_year, v_semester,
        v_email, 'import', v_batch
      );

      v_inserted := v_inserted + 1;
    exception when others then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object(
          'row', v_index,
          'usn', v_row ->> 'usn',
          'message', sqlerrm
        )
      );
    end;
  end loop;

  update public.import_batches
  set inserted_rows = v_inserted,
      skipped_rows = v_skipped,
      errors = v_errors
  where id = v_batch;

  return jsonb_build_object(
    'batch_id', v_batch,
    'total_rows', v_total,
    'inserted_rows', v_inserted,
    'skipped_rows', v_skipped,
    'errors', v_errors
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.student_directory enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.pe_memberships enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_logs enable row level security;

create policy "departments_read_active_or_admin"
  on public.departments for select to authenticated
  using (is_active or public.is_pe_admin());

create policy "departments_admin_insert"
  on public.departments for insert to authenticated
  with check (public.is_pe_admin());

create policy "departments_admin_update"
  on public.departments for update to authenticated
  using (public.is_pe_admin())
  with check (public.is_pe_admin());

create policy "departments_admin_delete"
  on public.departments for delete to authenticated
  using (public.is_pe_admin());

create policy "directory_read_admin_or_self"
  on public.student_directory for select to authenticated
  using (
    public.is_pe_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.student_directory_id = student_directory.id
    )
  );

create policy "directory_admin_insert"
  on public.student_directory for insert to authenticated
  with check (public.is_pe_admin());

create policy "directory_admin_update"
  on public.student_directory for update to authenticated
  using (public.is_pe_admin())
  with check (public.is_pe_admin());

create policy "directory_admin_delete"
  on public.student_directory for delete to authenticated
  using (public.is_pe_admin());

create policy "profiles_read_self_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_pe_admin());

-- No INSERT / UPDATE / DELETE policy exists for profiles. Accounts are created
-- by the trusted registration service, and field changes go through
-- update_my_profile() or an authorised admin using a privileged path.

create policy "roles_read_self_or_admin"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_pe_admin());

-- No client-writable role policy: roles are assigned only by the documented
-- bootstrap SQL, by the registration service (student role) or by a future
-- audited admin function.

create policy "membership_read_admin_or_self"
  on public.pe_memberships for select to authenticated
  using (
    public.is_pe_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.student_directory_id = pe_memberships.student_directory_id
    )
  );

-- Membership writes go exclusively through admin_set_pe_membership().

create policy "import_batches_admin_read"
  on public.import_batches for select to authenticated
  using (public.is_pe_admin());

-- Import batches are written by admin_import_student_directory().

create policy "audit_logs_admin_read"
  on public.audit_logs for select to authenticated
  using (public.is_pe_admin());

-- ---------------------------------------------------------------------------
-- Grants — RLS still applies to every table listed below
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, anon;

revoke all on public.departments, public.student_directory, public.profiles,
  public.user_roles, public.pe_memberships, public.import_batches,
  public.audit_logs from anon, authenticated;

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.student_directory to authenticated;
grant select on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.pe_memberships to authenticated;
grant select on public.import_batches to authenticated;
grant select on public.audit_logs to authenticated;

revoke all on function public.normalize_usn(text) from public;
grant execute on function public.normalize_usn(text) to authenticated, anon;

revoke all on function public.is_pe_admin(uuid) from public;
revoke all on function public.has_role(text, uuid) from public;
grant execute on function public.is_pe_admin(uuid) to authenticated;
grant execute on function public.has_role(text, uuid) to authenticated;

revoke all on function public.update_my_profile(text) from public;
revoke all on function public.admin_set_pe_membership(uuid, boolean, text) from public;
revoke all on function public.admin_import_student_directory(jsonb, text) from public;
grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.admin_set_pe_membership(uuid, boolean, text) to authenticated;
grant execute on function public.admin_import_student_directory(jsonb, text) to authenticated;

-- Internal triggers/functions stay owner-only.
revoke all on function public.set_updated_at() from public;
revoke all on function public.normalize_department_code() from public;
revoke all on function public.normalize_student_usn() from public;
revoke all on function public.audit_row_change() from public;
