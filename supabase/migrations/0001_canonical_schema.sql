-- ============================================================================
-- MindPulse – canonical Supabase schema, legacy reconciliation and RLS
-- ============================================================================
-- Run once (safely re-runnable) in the Supabase SQL Editor for project
-- whihfwcygbqpjtrpnlck, or with `supabase db push`.
--
-- Goals:
--   1. Create the canonical application tables:
--        profiles, doctor_profiles, stress_sessions, appointments,
--        chat_messages, video_sessions, notifications
--   2. Reconcile the legacy tables USER / STUDENT_PROFILES / DOCTOR_PROFILES /
--      ASSESSMENT_SESSIONS (and NOTIFICATIONS, MESSAGES) into the canonical
--      structure without losing data and without guessing identities.
--      Legacy USER_ID values are NOT assumed to equal auth.users.id – rows are
--      only mapped when the legacy e-mail matches an auth.users row.
--      Everything that cannot be mapped safely is written to
--      public.migration_report instead of being invented.
--   3. Enable relationship based Row Level Security on every canonical table.
--   4. Make profiles.role immutable for ordinary clients.
--   5. Provide server side account provisioning for the admin console so the
--      browser never sees a privileged key.
--
-- Nothing in this script drops or truncates a table. The only structural
-- change to a legacy object is the removal of the obsolete foreign key that
-- made public."MIND_PLANT_PROGRESS" unusable (section 6b).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Small helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Ordinary clients may never change their own (or anyone's) role.
-- NOTE: the function must exist before the trigger that calls it.
create or replace function public.profiles_protect_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Backfills / migrations run outside an authenticated request.
  if auth.uid() is null then
    return new;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  raise exception 'Account role cannot be changed by this user';
end;
$$;

-- ---------------------------------------------------------------------------
-- 0b. Reconcile pre-existing canonical tables
-- ---------------------------------------------------------------------------
-- `create table if not exists` silently does nothing when the table is
-- already there, so a canonical table created earlier by the mobile/web apps
-- (public.profiles and public.stress_sessions pre-date this script) would
-- keep its old shape and every later statement that references a canonical
-- column would fail. This block only ever ADDS missing columns – nothing is
-- dropped, renamed or rewritten, so existing rows always survive.
--
-- Key columns are different: a canonical table that is missing its identity
-- column cannot be mapped safely, so it aborts with an explicit message
-- instead of inventing ids.
-- First run: the tables do not exist yet, the block skips them and the
-- `create table if not exists` statements below build the full shape.

do $do$
declare
  r record;
begin
  for r in
    select * from (values
      -- profiles
      ('profiles', 'id',                  $c$uuid primary key references auth.users (id) on delete cascade$c$, true),
      ('profiles', 'first_name',          $c$text$c$, false),
      ('profiles', 'last_name',           $c$text$c$, false),
      ('profiles', 'full_name',           $c$text$c$, false),
      ('profiles', 'email',               $c$text$c$, false),
      ('profiles', 'role',                $c$text not null default 'student'$c$, false),
      ('profiles', 'year_level',          $c$text$c$, false),
      ('profiles', 'program',             $c$text$c$, false),
      ('profiles', 'living_situation',    $c$text$c$, false),
      ('profiles', 'student_no',          $c$text$c$, false),
      ('profiles', 'department',          $c$text$c$, false),
      ('profiles', 'birth_date',          $c$date$c$, false),
      ('profiles', 'sex',                 $c$text$c$, false),
      ('profiles', 'mental_conditions',   $c$jsonb not null default '[]'::jsonb$c$, false),
      ('profiles', 'physical_conditions', $c$jsonb not null default '[]'::jsonb$c$, false),
      ('profiles', 'lifestyle_habits',    $c$jsonb not null default '[]'::jsonb$c$, false),
      ('profiles', 'none_apply',          $c$boolean not null default false$c$, false),
      ('profiles', 'onboarding_complete', $c$boolean not null default false$c$, false),
      ('profiles', 'created_at',          $c$timestamptz not null default now()$c$, false),
      ('profiles', 'updated_at',          $c$timestamptz not null default now()$c$, false),
      -- doctor_profiles
      ('doctor_profiles', 'id',               $c$uuid primary key default gen_random_uuid()$c$, true),
      ('doctor_profiles', 'user_id',          $c$uuid not null unique references public.profiles (id) on delete cascade$c$, true),
      ('doctor_profiles', 'specialization',   $c$text$c$, false),
      ('doctor_profiles', 'contact_number',   $c$text$c$, false),
      ('doctor_profiles', 'license_no',       $c$text$c$, false),
      ('doctor_profiles', 'is_verified',      $c$boolean not null default false$c$, false),
      ('doctor_profiles', 'bio',              $c$text$c$, false),
      ('doctor_profiles', 'tags',             $c$text[] not null default '{}'::text[]$c$, false),
      ('doctor_profiles', 'availability_notes', $c$text$c$, false),
      ('doctor_profiles', 'created_at',       $c$timestamptz not null default now()$c$, false),
      ('doctor_profiles', 'updated_at',       $c$timestamptz not null default now()$c$, false),
      -- stress_sessions
      ('stress_sessions', 'id',               $c$uuid primary key default gen_random_uuid()$c$, true),
      ('stress_sessions', 'user_id',          $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('stress_sessions', 'score',            $c$integer$c$, false),
      ('stress_sessions', 'stress_level',     $c$text$c$, false),
      ('stress_sessions', 'heart_rate',       $c$integer$c$, false),
      ('stress_sessions', 'survey_score',     $c$integer$c$, false),
      ('stress_sessions', 'emotion',          $c$text$c$, false),
      ('stress_sessions', 'reaction_time_ms', $c$integer$c$, false),
      ('stress_sessions', 'face_confidence',  $c$integer$c$, false),
      ('stress_sessions', 'notes',            $c$text$c$, false),
      ('stress_sessions', 'created_at',       $c$timestamptz not null default now()$c$, false),
      -- appointments
      ('appointments', 'id',            $c$uuid primary key default gen_random_uuid()$c$, true),
      ('appointments', 'patient_id',    $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('appointments', 'doctor_id',     $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('appointments', 'scheduled_for', $c$text not null default ''$c$, false),
      ('appointments', 'status',        $c$text not null default 'scheduled'$c$, false),
      ('appointments', 'notes',         $c$text$c$, false),
      ('appointments', 'created_at',    $c$timestamptz not null default now()$c$, false),
      ('appointments', 'updated_at',    $c$timestamptz not null default now()$c$, false),
      -- chat_messages
      ('chat_messages', 'id',           $c$uuid primary key default gen_random_uuid()$c$, true),
      ('chat_messages', 'patient_id',   $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('chat_messages', 'clinician_id', $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('chat_messages', 'sender',       $c$text not null default 'patient'$c$, false),
      ('chat_messages', 'text',         $c$text not null default ''$c$, false),
      ('chat_messages', 'created_at',   $c$timestamptz not null default now()$c$, false),
      -- video_sessions
      ('video_sessions', 'id',             $c$uuid primary key default gen_random_uuid()$c$, true),
      ('video_sessions', 'patient_id',     $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('video_sessions', 'doctor_id',      $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('video_sessions', 'appointment_id', $c$uuid$c$, false),
      ('video_sessions', 'room_name',      $c$text not null default ''$c$, false),
      ('video_sessions', 'meeting_url',    $c$text$c$, false),
      ('video_sessions', 'token',          $c$text$c$, false),
      ('video_sessions', 'status',         $c$text not null default 'pending'$c$, false),
      ('video_sessions', 'created_at',     $c$timestamptz not null default now()$c$, false),
      -- notifications
      ('notifications', 'id',         $c$uuid primary key default gen_random_uuid()$c$, true),
      ('notifications', 'user_id',    $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('notifications', 'title',      $c$text not null default ''$c$, false),
      ('notifications', 'message',    $c$text not null default ''$c$, false),
      ('notifications', 'type',       $c$text not null default 'info'$c$, false),
      ('notifications', 'read',       $c$boolean not null default false$c$, false),
      ('notifications', 'created_at', $c$timestamptz not null default now()$c$, false),
      -- recommendations
      ('recommendations', 'id',         $c$uuid primary key default gen_random_uuid()$c$, true),
      ('recommendations', 'student_id', $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('recommendations', 'doctor_id',  $c$uuid not null references auth.users (id) on delete cascade$c$, true),
      ('recommendations', 'category',   $c$text not null default 'General'$c$, false),
      ('recommendations', 'priority',   $c$text not null default 'Medium'$c$, false),
      ('recommendations', 'note',       $c$text not null default ''$c$, false),
      ('recommendations', 'status',     $c$text not null default 'Active'$c$, false),
      ('recommendations', 'created_at', $c$timestamptz not null default now()$c$, false),
      ('recommendations', 'updated_at', $c$timestamptz not null default now()$c$, false)
    ) as t(tbl, col, ddl, is_key)
  loop
    if to_regclass('public.' || quote_ident(r.tbl)) is null then
      continue;  -- not created yet: the canonical DDL below builds it whole
    end if;

    if exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = r.tbl
        and c.column_name = r.col
    ) then
      continue;
    end if;

    if r.is_key then
      raise exception 'public.% has no column % – reconcile the pre-existing table manually with this script''s canonical definition (ids must never be invented), then re-run',
                      r.tbl, r.col;
    end if;

    execute format('alter table public.%I add column %I %s', r.tbl, r.col, r.ddl);
    raise notice 'reconciled public.% : added column % (%)', r.tbl, r.col, r.ddl;
  end loop;

  -- The clients upsert on their key column (profiles on id, doctor_profiles
  -- on user_id), which requires a unique key even when the table pre-dates
  -- this script. A primary key is added for id columns, a plain unique
  -- constraint for the others – and only when the data allows it.
  for r in
    select * from (values
      ('profiles', 'id'), ('doctor_profiles', 'id'), ('doctor_profiles', 'user_id'),
      ('stress_sessions', 'id'), ('appointments', 'id'), ('chat_messages', 'id'),
      ('video_sessions', 'id'), ('notifications', 'id'), ('recommendations', 'id')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || quote_ident(r.tbl)) is null then
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
    ) then
      continue;  -- already reported above as a missing key
    end if;

    if exists (
      select 1
        from pg_index i
       where i.indrelid = to_regclass('public.' || quote_ident(r.tbl))
         and i.indisunique
         and i.indnkeyatts = 1
         and (select a.attname from pg_attribute a
               where a.attrelid = i.indrelid and a.attnum = i.indkey[0]) = r.col
    ) then
      continue;  -- already unique on exactly this column
    end if;

    if r.col = 'id' and exists (
      select 1 from pg_constraint
       where conrelid = to_regclass('public.' || quote_ident(r.tbl))
         and contype = 'p'
    ) then
      raise notice 'public.% already has a primary key on a different column than id – reconcile it manually', r.tbl;
      continue;
    end if;

    begin
      if r.col = 'id' then
        execute format(
          'alter table public.%I add constraint %I primary key (%I)',
          r.tbl, r.tbl || '_' || r.col || '_pkey', r.col
        );
        raise notice 'reconciled public.% : added primary key (%)', r.tbl, r.col;
      else
        execute format(
          'alter table public.%I add constraint %I unique (%I)',
          r.tbl, r.tbl || '_' || r.col || '_key', r.col
        );
        raise notice 'reconciled public.% : added unique key (%)', r.tbl, r.col;
      end if;
    exception when unique_violation or not_null_violation or duplicate_object or duplicate_table then
      raise notice 'public.% : column % could not be keyed (nulls, duplicates or an existing key) – reconcile it manually', r.tbl, r.col;
    end;
  end loop;

  -- profiles.role must be constrained to the three application roles even when
  -- the table pre-dates this script (only added when every existing value
  -- already conforms, so real data is never invalidated).
  -- Nested if, not a single "and" chain: the whole condition of one if is
  -- planned as a single expression, so the subqueries on public.profiles
  -- would be resolved at plan time - before the table exists on a first run.
  if to_regclass('public.profiles') is not null then
    if not exists (
      select 1 from pg_constraint
       where conrelid = 'public.profiles'::regclass
         and contype = 'c'
         and conname = 'profiles_role_check'
    )
    and not exists (
      select 1 from public.profiles where role not in ('student', 'doctor', 'admin')
    ) then
      alter table public.profiles
        add constraint profiles_role_check check (role in ('student', 'doctor', 'admin'));
    end if;
  end if;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 1. profiles  (canonical application profile, id = auth.users.id)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  first_name         text,
  last_name          text,
  full_name          text,
  email              text,
  role               text not null default 'student'
                     check (role in ('student', 'doctor', 'admin')),
  year_level         text,
  program            text,
  living_situation   text,
  student_no         text,
  department         text,
  birth_date         date,
  sex                text,
  mental_conditions  jsonb not null default '[]'::jsonb,
  physical_conditions jsonb not null default '[]'::jsonb,
  lifestyle_habits   jsonb not null default '[]'::jsonb,
  none_apply         boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (lower(email));

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function public.profiles_protect_role();

-- ---------------------------------------------------------------------------
-- 2. doctor_profiles  (one canonical doctor profile per doctor)
-- ---------------------------------------------------------------------------

create table if not exists public.doctor_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  specialization  text,
  contact_number  text,
  license_no      text,
  is_verified     boolean not null default false,
  bio             text,
  tags            text[] not null default '{}',
  availability_notes text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists doctor_profiles_updated_at on public.doctor_profiles;
create trigger doctor_profiles_updated_at
  before update on public.doctor_profiles
  for each row execute function public.set_updated_at();

-- Promoting an account to doctor always gives it a clinical profile row, so
-- the doctor console never sees a missing doctor_profiles record.
create or replace function public.profiles_ensure_doctor_row()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.doctor_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_doctor_row on public.profiles;
create trigger profiles_ensure_doctor_row
  after insert or update of role on public.profiles
  for each row
  when (new.role = 'doctor')
  execute function public.profiles_ensure_doctor_row();

-- ---------------------------------------------------------------------------
-- 3. stress_sessions  (canonical completed stress assessments)
-- ---------------------------------------------------------------------------

create table if not exists public.stress_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  score            integer,
  stress_level     text check (stress_level in ('Low', 'Moderate', 'High')),
  heart_rate       integer,
  survey_score     integer,
  emotion          text,
  reaction_time_ms integer,
  face_confidence  integer,
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists stress_sessions_user_idx
  on public.stress_sessions (user_id, created_at desc);
create index if not exists stress_sessions_level_idx
  on public.stress_sessions (stress_level);

-- ---------------------------------------------------------------------------
-- 4. appointments
-- ---------------------------------------------------------------------------

create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references auth.users (id) on delete cascade,
  doctor_id     uuid not null references auth.users (id) on delete cascade,
  scheduled_for text not null,
  status        text not null default 'scheduled'
                check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists appointments_patient_idx on public.appointments (patient_id, created_at desc);
create index if not exists appointments_doctor_idx  on public.appointments (doctor_id, created_at desc);

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. chat_messages
-- ---------------------------------------------------------------------------

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references auth.users (id) on delete cascade,
  clinician_id uuid not null references auth.users (id) on delete cascade,
  sender       text not null check (sender in ('patient', 'doctor')),
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists chat_messages_pair_idx
  on public.chat_messages (patient_id, clinician_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. video_sessions
-- ---------------------------------------------------------------------------

create table if not exists public.video_sessions (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references auth.users (id) on delete cascade,
  doctor_id      uuid not null references auth.users (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  room_name      text not null,
  meeting_url    text,
  token          text,
  status         text not null default 'pending'
                 check (status in ('pending', 'active', 'live', 'ended', 'connecting')),
  created_at     timestamptz not null default now()
);

create index if not exists video_sessions_patient_idx on public.video_sessions (patient_id, created_at desc);
create index if not exists video_sessions_doctor_idx  on public.video_sessions (doctor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  message     text not null,
  type        text not null default 'info'
              check (type in ('alert', 'info', 'appointment')),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7b. recommendations  (doctor -> student clinical guidance, persistent)
-- ---------------------------------------------------------------------------
-- The doctor console writes these and the student is the recipient, so they
-- need real storage: a recommendation is a database entity, not a UI prop.

create table if not exists public.recommendations (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references auth.users (id) on delete cascade,
  doctor_id   uuid not null references auth.users (id) on delete cascade,
  category    text not null default 'General',
  priority    text not null default 'Medium'
              check (priority in ('Low', 'Medium', 'High')),
  note        text not null,
  status      text not null default 'Active'
              check (status in ('Active', 'Completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists recommendations_student_idx
  on public.recommendations (student_id, created_at desc);
create index if not exists recommendations_doctor_idx
  on public.recommendations (doctor_id, created_at desc);

drop trigger if exists recommendations_updated_at on public.recommendations;
create trigger recommendations_updated_at
  before update on public.recommendations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. migration_report – records legacy rows that cannot be mapped safely
-- ---------------------------------------------------------------------------

create table if not exists public.migration_report (
  id            uuid primary key default gen_random_uuid(),
  legacy_table  text not null,
  legacy_id     text,
  legacy_email  text,
  problem       text not null,
  created_at    timestamptz not null default now(),
  unique (legacy_table, legacy_id, problem)
);

-- ---------------------------------------------------------------------------
-- 8b. Relationship helper functions
--     These use `language sql`, whose bodies are validated at creation time,
--     so they must come after sections 1-8 create public.profiles and
--     public.appointments. (The plpgsql helpers in section 0 have no such
--     constraint and stay above the tables for their triggers.)
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER: avoids the RLS recursion that would happen if a policy on
-- profiles queried profiles directly.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'doctor' from public.profiles p where p.id = auth.uid()), false);
$$;

-- True when the current user already has a consultation/appointment link to
-- the given profile (patient <-> doctor).
create or replace function public.has_appointment_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where (a.patient_id = auth.uid() and a.doctor_id = target)
       or (a.doctor_id  = auth.uid() and a.patient_id = target)
  );
$$;

-- True when the given account really is a doctor, so appointments can never
-- be written against an arbitrary user id.
create or replace function public.is_account_doctor(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'doctor' from public.profiles p where p.id = target), false);
$$;

-- ---------------------------------------------------------------------------
-- 9. Profile creation on signup (server side, single source of truth)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  meta_last  text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  meta_full  text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  if meta_full = '' then
    meta_full := trim(coalesce(meta_first, '') || ' ' || coalesce(meta_last, ''));
  end if;
  if meta_first = '' and meta_full <> '' then
    meta_first := split_part(meta_full, ' ', 1);
  end if;
  if meta_last = '' and meta_full <> '' and array_length(string_to_array(meta_full, ' '), 1) > 1 then
    meta_last := substring(meta_full from '\s(\S+)$');
  end if;

  insert into public.profiles (id, first_name, last_name, full_name, email, role)
  values (new.id, nullif(meta_first, ''), nullif(meta_last, ''), nullif(meta_full, ''),
          new.email, 'student')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'doctor_profiles', 'stress_sessions', 'appointments',
    'chat_messages', 'video_sessions', 'notifications', 'recommendations',
    'migration_report'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---- profiles ---------------------------------------------------------------
-- Visibility model: everyone sees their own row and the public professional
-- doctor directory; administrators see everything; a doctor only sees a
-- student's private profile once an appointment links the two (relationship
-- based authorization – a doctor never gets blanket read access to every
-- student); anyone who shares an appointment with a profile may read it.
drop policy if exists "profiles_select_self_admin_link" on public.profiles;
create policy "profiles_select_self_admin_link" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or role = 'doctor'                                    -- public professional directory
    or public.has_appointment_with(id)
  );

drop policy if exists "profiles_insert_self_student" on public.profiles;
create policy "profiles_insert_self_student" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and (role = 'student' or public.is_admin()));

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---- doctor_profiles --------------------------------------------------------
-- Owners and administrators manage the full row; every signed-up account may
-- read the directory entries of real doctors so the booking screen can show
-- specialization / bio / availability. Writing a row requires already being a
-- doctor (or an administrator), so a student cannot mint a doctor profile.
drop policy if exists "doctor_profiles_select" on public.doctor_profiles;
create policy "doctor_profiles_select" on public.doctor_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = doctor_profiles.user_id and p.role = 'doctor'
    )
  );

drop policy if exists "doctor_profiles_write_owner" on public.doctor_profiles;
create policy "doctor_profiles_write_owner" on public.doctor_profiles
  for insert to authenticated
  with check (
    public.is_admin()
    or (user_id = auth.uid() and public.current_app_role() = 'doctor')
  );

drop policy if exists "doctor_profiles_update_owner" on public.doctor_profiles;
create policy "doctor_profiles_update_owner" on public.doctor_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "doctor_profiles_delete_admin" on public.doctor_profiles;
create policy "doctor_profiles_delete_admin" on public.doctor_profiles
  for delete to authenticated using (public.is_admin());

-- ---- stress_sessions --------------------------------------------------------
-- Own rows, administrators, and anyone who shares an appointment with the
-- assessed student. Doctors are deliberately NOT given blanket access: they
-- read a student's assessments only through a real appointment link.
drop policy if exists "stress_sessions_select" on public.stress_sessions;
create policy "stress_sessions_select" on public.stress_sessions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_appointment_with(user_id)
  );

drop policy if exists "stress_sessions_insert_self" on public.stress_sessions;
create policy "stress_sessions_insert_self" on public.stress_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "stress_sessions_update_self" on public.stress_sessions;
create policy "stress_sessions_update_self" on public.stress_sessions
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "stress_sessions_delete_own" on public.stress_sessions;
create policy "stress_sessions_delete_own" on public.stress_sessions
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "stress_sessions_delete_admin" on public.stress_sessions;
create policy "stress_sessions_delete_admin" on public.stress_sessions
  for delete to authenticated using (public.is_admin());

-- ---- appointments -----------------------------------------------------------
drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select" on public.appointments
  for select to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());

drop policy if exists "appointments_insert" on public.appointments;
create policy "appointments_insert" on public.appointments
  for insert to authenticated
  with check (
    public.is_admin()
    or (patient_id = auth.uid() and public.is_account_doctor(doctor_id))
    or (doctor_id = auth.uid() and public.is_doctor())
  );

drop policy if exists "appointments_update" on public.appointments;
create policy "appointments_update" on public.appointments
  for update to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin())
  with check (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());

drop policy if exists "appointments_delete_admin" on public.appointments;
create policy "appointments_delete_admin" on public.appointments
  for delete to authenticated using (public.is_admin());

-- ---- chat_messages ----------------------------------------------------------
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select to authenticated
  using (patient_id = auth.uid() or clinician_id = auth.uid() or public.is_admin());

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated
  with check (
    (sender = 'patient' and patient_id = auth.uid())
    or (sender = 'doctor' and clinician_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own" on public.chat_messages
  for update to authenticated
  using (
    (sender = 'patient' and patient_id = auth.uid())
    or (sender = 'doctor' and clinician_id = auth.uid())
    or public.is_admin()
  )
  with check (
    (sender = 'patient' and patient_id = auth.uid())
    or (sender = 'doctor' and clinician_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "chat_messages_delete_admin" on public.chat_messages;
create policy "chat_messages_delete_admin" on public.chat_messages
  for delete to authenticated using (public.is_admin());

-- ---- video_sessions (token is only visible to the participants) -------------
-- Administrators are intentionally excluded: a Daily.co token is a
-- participant credential, not an administrative fact.
drop policy if exists "video_sessions_select" on public.video_sessions;
create policy "video_sessions_select" on public.video_sessions
  for select to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid());

drop policy if exists "video_sessions_insert" on public.video_sessions;
create policy "video_sessions_insert" on public.video_sessions
  for insert to authenticated
  with check (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());

drop policy if exists "video_sessions_update" on public.video_sessions;
create policy "video_sessions_update" on public.video_sessions
  for update to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin())
  with check (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());

drop policy if exists "video_sessions_delete_admin" on public.video_sessions;
create policy "video_sessions_delete_admin" on public.video_sessions
  for delete to authenticated using (public.is_admin());

-- ---- notifications ----------------------------------------------------------
-- Users read/write their own notifications; a patient may also notify the
-- doctor they just booked with (and vice versa) through the appointment link.
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_appointment_with(user_id)
  );

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---- recommendations --------------------------------------------------------
-- Only the two people on the recommendation see it: the student who receives
-- it and the doctor who issued it. Doctors write; students read.
drop policy if exists "recommendations_select" on public.recommendations;
create policy "recommendations_select" on public.recommendations
  for select to authenticated
  using (student_id = auth.uid() or doctor_id = auth.uid());

drop policy if exists "recommendations_insert" on public.recommendations;
create policy "recommendations_insert" on public.recommendations
  for insert to authenticated
  with check (doctor_id = auth.uid() and public.current_app_role() = 'doctor');

drop policy if exists "recommendations_update" on public.recommendations;
create policy "recommendations_update" on public.recommendations
  for update to authenticated
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

drop policy if exists "recommendations_delete" on public.recommendations;
create policy "recommendations_delete" on public.recommendations
  for delete to authenticated
  using (doctor_id = auth.uid());

-- ---- migration_report (readable by administrators only) ---------------------
drop policy if exists "migration_report_select_admin" on public.migration_report;
create policy "migration_report_select_admin" on public.migration_report
  for select to authenticated using (public.is_admin());

drop policy if exists "migration_report_write_service" on public.migration_report;
create policy "migration_report_write_service" on public.migration_report
  for insert to authenticated with check (public.is_admin());

-- ---- MindPlant tables (already used by the mobile app) ----------------------
do $$
declare
  t text;
begin
  foreach t in array array['MIND_PLANT_PROGRESS', 'GROWTH_LOG', 'GROWTH_STAGE'] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end;
$$;

-- supabase-plant-progress.sql created these tables/policies earlier; replace
-- them with the canonical names below so exactly one policy per action
-- exists. Each block is skipped when its table does not exist yet - this
-- script never invents application tables.
do $do$
begin
  if to_regclass('public."MIND_PLANT_PROGRESS"') is not null then
    drop policy if exists "Users can read their own plant progress" on public."MIND_PLANT_PROGRESS";
    drop policy if exists "Users can create their own plant progress" on public."MIND_PLANT_PROGRESS";
    drop policy if exists "Users can update their own plant progress" on public."MIND_PLANT_PROGRESS";
    drop policy if exists "plant_progress_select_own" on public."MIND_PLANT_PROGRESS";
    create policy "plant_progress_select_own" on public."MIND_PLANT_PROGRESS"
      for select to authenticated using ("USER_ID" = auth.uid() or public.is_admin());
    drop policy if exists "plant_progress_insert_own" on public."MIND_PLANT_PROGRESS";
    create policy "plant_progress_insert_own" on public."MIND_PLANT_PROGRESS"
      for insert to authenticated with check ("USER_ID" = auth.uid());
    drop policy if exists "plant_progress_update_own" on public."MIND_PLANT_PROGRESS";
    create policy "plant_progress_update_own" on public."MIND_PLANT_PROGRESS"
      for update to authenticated
      using ("USER_ID" = auth.uid() or public.is_admin())
      with check ("USER_ID" = auth.uid());
  end if;

  if to_regclass('public."GROWTH_LOG"') is not null then
    drop policy if exists "Users can read their own growth log" on public."GROWTH_LOG";
    drop policy if exists "Users can create their own growth log" on public."GROWTH_LOG";
    drop policy if exists "growth_log_select_own" on public."GROWTH_LOG";
    create policy "growth_log_select_own" on public."GROWTH_LOG"
      for select to authenticated using ("USER_ID" = auth.uid() or public.is_admin());
    drop policy if exists "growth_log_insert_own" on public."GROWTH_LOG";
    create policy "growth_log_insert_own" on public."GROWTH_LOG"
      for insert to authenticated with check ("USER_ID" = auth.uid());
  end if;

  if to_regclass('public."GROWTH_STAGE"') is not null then
    drop policy if exists "Authenticated users can read growth stages" on public."GROWTH_STAGE";
    drop policy if exists "growth_stage_select_all" on public."GROWTH_STAGE";
    create policy "growth_stage_select_all" on public."GROWTH_STAGE"
      for select to authenticated using (true);
  end if;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 6b. Plant progress is keyed by auth.uid()
-- ---------------------------------------------------------------------------
-- MIND_PLANT_PROGRESS still carries a legacy foreign key to
-- public."USER"(USER_ID), but the mobile app writes "USER_ID" = auth.uid() and
-- the policies above require exactly that. Because legacy USER rows hold
-- pre-auth ids, every plant write would fail that foreign key. The table is
-- empty, so the obsolete constraint is removed instead of inventing legacy
-- USER rows; the data model (one row per user, unique USER_ID, own-row RLS)
-- is unchanged.
do $$
declare
  v_con text;
begin
  if to_regclass('public."MIND_PLANT_PROGRESS"') is null then
    return;
  end if;

  select c.conname into v_con
    from pg_constraint c
   where c.conrelid = 'public."MIND_PLANT_PROGRESS"'::regclass
     and c.contype = 'f'
     and c.conkey = array[
       (select a.attnum from pg_attribute a
         where a.attrelid = 'public."MIND_PLANT_PROGRESS"'::regclass
           and a.attname = 'USER_ID')
     ];

  if v_con is not null then
    execute format('alter table public."MIND_PLANT_PROGRESS" drop constraint %I', v_con);
    raise notice 'MIND_PLANT_PROGRESS: dropped obsolete foreign key % (plant rows are keyed by auth.uid())', v_con;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Reconcile legacy tables into the canonical structure
-- ---------------------------------------------------------------------------
-- Rule: a legacy row is only mapped when lower(legacy email) matches an
-- auth.users row. Never guess. Unmappable rows are reported, not invented.

-- 11.1 report table for rows we refuse to guess about -------------------------
-- Every mapping block below is wrapped in an exception guard: if a legacy
-- table does not have the shape this script expects, the failure is recorded
-- in public.migration_report (with the exact SQL error) and the script keeps
-- going instead of rolling back the canonical schema. Legacy rows are never
-- guessed at and never modified.
do $$
begin
  begin
  if to_regclass('public."USER"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'USER', u."USER_ID"::text, u."EMAIL",
           'No auth.users row with this e-mail – legacy identity cannot be mapped to an authenticated user'
    from public."USER" u
    where not exists (select 1 from auth.users au where lower(au.email) = lower(u."EMAIL"))
    on conflict do nothing;
  end if;

  if to_regclass('public."DOCTOR_PROFILES"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'DOCTOR_PROFILES', d."DOCTOR_PROFILE_ID"::text, u."EMAIL",
           'Doctor profile points at a legacy USER_ID that has no matching auth.users row'
    from public."DOCTOR_PROFILES" d
    left join public."USER" u on u."USER_ID" = d."USER_ID"
    where not exists (
      select 1 from auth.users au
      where lower(au.email) = lower(coalesce(u."EMAIL", ''))
    )
    on conflict do nothing;
  end if;

  if to_regclass('public."ASSESSMENT_SESSIONS"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'ASSESSMENT_SESSIONS', s."SESSION_ID"::text, u."EMAIL",
           'Assessment session points at a legacy USER_ID that has no matching auth.users row'
    from public."ASSESSMENT_SESSIONS" s
    left join public."USER" u on u."USER_ID" = s."USER_ID"
    where not exists (
      select 1 from auth.users au
      where lower(au.email) = lower(coalesce(u."EMAIL", ''))
    )
    on conflict do nothing;
  end if;

  if to_regclass('public."STUDENT_PROFILES"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'STUDENT_PROFILES', sp."STUDENT_PROFILE_ID"::text, u."EMAIL",
           'Student profile points at a legacy USER_ID with no USER row / no matching auth.users row'
    from public."STUDENT_PROFILES" sp
    left join public."USER" u on u."USER_ID" = sp."USER_ID"
    where u."USER_ID" is null
       or not exists (select 1 from auth.users au where lower(au.email) = lower(u."EMAIL"))
    on conflict do nothing;
  end if;

  exception when others then
    insert into public.migration_report (legacy_table, legacy_id, problem)
    values ('legacy-scan', 'scan', 'legacy table scan failed: ' || sqlerrm)
    on conflict do nothing;
    raise notice 'legacy table scan failed (recorded in migration_report): %', sqlerrm;
  end;
end;
$$;

-- 11.2 profiles <- USER + STUDENT_PROFILES -----------------------------------
do $$
begin
  begin
  if to_regclass('public."USER"') is null then
    return;
  end if;

  insert into public.profiles (
    id, first_name, last_name, full_name, email, role,
    student_no, department, birth_date, sex, year_level, program,
    onboarding_complete, created_at, updated_at
  )
  select
    au.id,
    u."FIRST_NAME",
    u."LAST_NAME",
    nullif(trim(coalesce(u."FIRST_NAME", '') || ' ' || coalesce(u."LAST_NAME", '')), ''),
    u."EMAIL",
    case lower(coalesce(u."ROLE", 'student'))
      when 'doctor' then 'doctor'
      when 'admin'  then 'admin'
      else 'student'
    end,
    sp."STUDENT_NO",
    sp."DEPARTMENT",
    sp."BIRTH_DATE",
    sp."SEX",
    case sp."YEAR_LEVEL"
      when 1 then '1st Year'
      when 2 then '2nd Year'
      when 3 then '3rd Year'
      when 4 then '4th Year'
      when 5 then '5th Year'
      else null
    end,
    sp."COURSE",
    sp."STUDENT_PROFILE_ID" is not null,
    coalesce(u."CREATED_AT", now()),
    now()
  from public."USER" u
  join auth.users au on lower(au.email) = lower(u."EMAIL")
  left join public."STUDENT_PROFILES" sp on sp."USER_ID" = u."USER_ID"
  on conflict (id) do update set
    first_name  = coalesce(excluded.first_name, public.profiles.first_name),
    last_name   = coalesce(excluded.last_name, public.profiles.last_name),
    full_name   = coalesce(excluded.full_name, public.profiles.full_name),
    email       = coalesce(excluded.email, public.profiles.email),
    -- legacy data may promote a row, but must never demote a non-student
    role        = case when excluded.role = 'student'
                       then public.profiles.role
                       else excluded.role end,
    student_no  = coalesce(excluded.student_no, public.profiles.student_no),
    department  = coalesce(excluded.department, public.profiles.department),
    birth_date  = coalesce(excluded.birth_date, public.profiles.birth_date),
    sex         = coalesce(excluded.sex, public.profiles.sex),
    year_level  = coalesce(excluded.year_level, public.profiles.year_level),
    program     = coalesce(excluded.program, public.profiles.program),
    onboarding_complete = (public.profiles.onboarding_complete or excluded.onboarding_complete);

  exception when others then
    insert into public.migration_report (legacy_table, legacy_id, problem)
    values ('USER', 'mapping', 'profiles <- USER/STUDENT_PROFILES mapping failed: ' || sqlerrm)
    on conflict do nothing;
    raise notice 'profiles <- USER mapping failed (recorded in migration_report): %', sqlerrm;
  end;
end;
$$;

-- 11.3 every profile that has role = doctor gets one doctor_profiles row ------
insert into public.doctor_profiles (user_id)
select p.id from public.profiles p
where p.role = 'doctor'
  and not exists (select 1 from public.doctor_profiles d where d.user_id = p.id)
on conflict (user_id) do nothing;

-- 11.4 doctor_profiles <- DOCTOR_PROFILES ------------------------------------
do $$
begin
  begin
  if to_regclass('public."DOCTOR_PROFILES"') is null then
    return;
  end if;

  -- A legacy clinical profile only promotes a mapped account that is still a
  -- student; admins are never demoted, and unmapped doctors stay in the
  -- migration report (section 11.1).
  update public.profiles p
  set role = 'doctor'
  from public."DOCTOR_PROFILES" d
       join public."USER" u on u."USER_ID" = d."USER_ID"
       join auth.users au on lower(au.email) = lower(u."EMAIL")
  where p.id = au.id and p.role = 'student';

  insert into public.doctor_profiles (
    user_id, specialization, contact_number, license_no, is_verified,
    availability_notes, created_at, updated_at
  )
  select
    au.id,
    d."SPECIALIZATION",
    d."CONTACT_NUMBER",
    d."LICENSE_NO",
    coalesce(d."IS_VERIFIED", false),
    d."AVAILABILITY_NOTES",
    now(),
    now()
  from public."DOCTOR_PROFILES" d
  join public."USER" u on u."USER_ID" = d."USER_ID"
  join auth.users au on lower(au.email) = lower(u."EMAIL")
  where au.id in (select id from public.profiles where role = 'doctor')
  on conflict (user_id) do update set
    specialization   = coalesce(excluded.specialization, public.doctor_profiles.specialization),
    contact_number   = coalesce(excluded.contact_number, public.doctor_profiles.contact_number),
    license_no       = coalesce(excluded.license_no, public.doctor_profiles.license_no),
    is_verified      = coalesce(excluded.is_verified, public.doctor_profiles.is_verified),
    availability_notes = coalesce(excluded.availability_notes, public.doctor_profiles.availability_notes);

  exception when others then
    insert into public.migration_report (legacy_table, legacy_id, problem)
    values ('DOCTOR_PROFILES', 'mapping', 'doctor_profiles <- DOCTOR_PROFILES mapping failed: ' || sqlerrm)
    on conflict do nothing;
    raise notice 'doctor_profiles mapping failed (recorded in migration_report): %', sqlerrm;
  end;
end;
$$;

-- 11.5 stress_sessions <- ASSESSMENT_SESSIONS (+ related modality tables) -----
-- The mapped timestamp must be derivable from the legacy row alone so that a
-- re-run of this script recognises rows it created earlier (a plain now()
-- would be different every run and would duplicate the data).
do $$
begin
  begin
  if to_regclass('public."ASSESSMENT_SESSIONS"') is null then
    return;
  end if;

  insert into public.stress_sessions (
    user_id, score, stress_level, heart_rate, survey_score, emotion,
    reaction_time_ms, face_confidence, notes, created_at
  )
  select
    au.id,
    s."OVERALL_STRESS_SCORE",
    case
      when upper(coalesce(s."OVERALL_STRESS_LEVEL", '')) like '%HIGH%' then 'High'
      when upper(coalesce(s."OVERALL_STRESS_LEVEL", '')) like '%MODERATE%' then 'Moderate'
      when upper(coalesce(s."OVERALL_STRESS_LEVEL", '')) like '%LOW%' then 'Low'
      when s."OVERALL_STRESS_SCORE" > 60 then 'High'
      when s."OVERALL_STRESS_SCORE" > 30 then 'Moderate'
      else 'Low'
    end,
    hr.computed_bpm,
    sr.normalized_score,
    fa.dominant_emotion,
    rt.average_reaction_ms,
    case when fa.emotion_confidence is null then null
         else round(fa.emotion_confidence * 100)::int end,
    nullif(trim(coalesce(s."REMARKS", '')), ''),
    coalesce(s."COMPLETED_AT", s."STARTED_AT",
             s."SESSION_DATE"::timestamptz, 'epoch'::timestamptz)
  from public."ASSESSMENT_SESSIONS" s
  join public."USER" u on u."USER_ID" = s."USER_ID"
  join auth.users au on lower(au.email) = lower(u."EMAIL")
  left join lateral (
    select h."COMPUTED_BPM" as computed_bpm
    from public."HEART_RATE_RECORDS" h
    where h."SESSION_ID" = s."SESSION_ID"
    order by h."RECORDED_AT" desc
    limit 1
  ) hr on true
  left join lateral (
    select r."AVERAGE_REACTION_MS" as average_reaction_ms
    from public."REACTION_TEST_RESULTS" r
    where r."SESSION_ID" = s."SESSION_ID"
    order by r."RECORDED_AT" desc
    limit 1
  ) rt on true
  left join lateral (
    select f."DOMINANT_EMOTION" as dominant_emotion,
           f."EMOTION_CONFIDENCE" as emotion_confidence
    from public."FACIAL_ANALYSIS_RESULTS" f
    where f."SESSION_ID" = s."SESSION_ID"
    order by f."PROCESSED_AT" desc
    limit 1
  ) fa on true
  left join lateral (
    select sr2."NORMALIZED_SCORE" as normalized_score
    from public."SURVEY_RESULTS" sr2
    where sr2."SESSION_ID" = s."SESSION_ID"
    order by sr2."CREATED_AT" desc
    limit 1
  ) sr on true
  where not exists (
    select 1 from public.stress_sessions existing
    where existing.user_id = au.id
      and existing.created_at = coalesce(s."COMPLETED_AT", s."STARTED_AT",
                                         s."SESSION_DATE"::timestamptz, 'epoch'::timestamptz)
      and existing.score is not distinct from s."OVERALL_STRESS_SCORE"
  );

  -- Safety net for runs that pre-date the guard above: keep one row per
  -- identical (user, score, level, timestamp) tuple.
  delete from public.stress_sessions a
  using public.stress_sessions b
  where a.ctid < b.ctid
    and a.user_id = b.user_id
    and a.score is not distinct from b.score
    and a.stress_level is not distinct from b.stress_level
    and a.created_at is not distinct from b.created_at;

  exception when others then
    insert into public.migration_report (legacy_table, legacy_id, problem)
    values ('ASSESSMENT_SESSIONS', 'mapping', 'stress_sessions <- ASSESSMENT_SESSIONS mapping failed: ' || sqlerrm)
    on conflict do nothing;
    raise notice 'stress_sessions mapping failed (recorded in migration_report): %', sqlerrm;
  end;
end;
$$;

-- 11.6 notifications <- NOTIFICATIONS ----------------------------------------
do $$
begin
  begin
  if to_regclass('public."NOTIFICATIONS"') is null then
    return;
  end if;

  insert into public.notifications (id, user_id, title, message, type, read, created_at)
  select
    n."NOTIFICATION_ID",
    au.id,
    n."TITLE",
    coalesce(n."MESSAGE", ''),
    case lower(coalesce(n."NOTIFICATION_TYPE", 'info'))
      when 'alert' then 'alert'
      when 'appointment' then 'appointment'
      else 'info'
    end,
    coalesce(n."IS_READ", false),
    coalesce(n."CREATED_AT", now())
  from public."NOTIFICATIONS" n
  join public."USER" u on u."USER_ID" = n."USER_ID"
  join auth.users au on lower(au.email) = lower(u."EMAIL")
  on conflict (id) do nothing;

  exception when others then
    insert into public.migration_report (legacy_table, legacy_id, problem)
    values ('NOTIFICATIONS', 'mapping', 'notifications <- NOTIFICATIONS mapping failed: ' || sqlerrm)
    on conflict do nothing;
    raise notice 'notifications mapping failed (recorded in migration_report): %', sqlerrm;
  end;
end;
$$;

-- 11.7 chat_messages <- CONVERSATIONS + MESSAGES -----------------------------
do $$
begin
  begin
  if to_regclass('public."CONVERSATIONS"') is null
     or to_regclass('public."MESSAGES"') is null then
    return;
  end if;

  insert into public.chat_messages (id, patient_id, clinician_id, sender, text, created_at)
  select
    m."MESSAGE_ID",
    pa.id,
    doc.id,
    case when lower(coalesce(u."ROLE", 'student')) = 'doctor' then 'doctor' else 'patient' end,
    m."MESSAGE_TEXT",
    coalesce(m."SENT_AT", now())
  from public."MESSAGES" m
  join public."CONVERSATIONS" c on c."CONVERSATION_ID" = m."CONVERSATION_ID"
  join public."USER" u on u."USER_ID" = m."SENDER_USER_ID"
  join auth.users pa on lower(pa.email) = lower((select uu."EMAIL" from public."USER" uu where uu."USER_ID" = c."STUDENT_USER_ID"))
  join auth.users doc on lower(doc.email) = lower((select uu."EMAIL" from public."USER" uu where uu."USER_ID" = c."DOCTOR_USER_ID"))
  on conflict (id) do nothing;

  exception when others then
    insert into public.migration_report (legacy_table, legacy_id, problem)
    values ('MESSAGES', 'mapping', 'chat_messages <- CONVERSATIONS/MESSAGES mapping failed: ' || sqlerrm)
    on conflict do nothing;
    raise notice 'chat_messages mapping failed (recorded in migration_report): %', sqlerrm;
  end;
end;
$$;

-- 11.8 profiles <- auth.users (every signed-up account gets a profile) -------
-- Accounts created before the on_auth_user_created trigger, or without any
-- legacy identity, still need a profile or they cannot use the app. Their
-- role is never guessed: without a legacy identity they receive the same
-- default a public sign-up gets ('student'), and the account is written to
-- migration_report so an administrator can review and promote it.
do $$
declare
  au record;
  v_full  text;
  v_first text;
  v_last  text;
begin
  for au in
    select u.id, u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb) as meta
    from auth.users u
    where u.email is not null
      and not exists (select 1 from public.profiles p where p.id = u.id)
  loop
    v_full := nullif(trim(coalesce(
      au.meta ->> 'full_name',
      trim(coalesce(au.meta ->> 'first_name', '') || ' ' || coalesce(au.meta ->> 'last_name', ''))
    )), '');

    v_first := nullif(trim(coalesce(
      au.meta ->> 'first_name',
      case when v_full is not null then split_part(v_full, ' ', 1) else '' end
    )), '');

    v_last := nullif(trim(coalesce(
      au.meta ->> 'last_name',
      case when v_full is not null and position(' ' in v_full) > 0
           then substr(v_full, position(' ' in v_full) + 1)
           else '' end
    )), '');

    insert into public.profiles (id, email, first_name, last_name, full_name, role)
    values (au.id, au.email, v_first, v_last, v_full, 'student')
    on conflict (id) do nothing;

    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    values ('auth.users', au.id::text, au.email,
            'No legacy identity for this account – profile created with the default role (student); an administrator can change it')
    on conflict do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Verification (aborts if legacy data existed but nothing was mapped)
-- ---------------------------------------------------------------------------
do $$
declare
  legacy_users int := 0;
  mapped_profiles int := 0;
  legacy_sessions int := 0;
  mapped_sessions int := 0;
  orphans int := 0;
begin
  if to_regclass('public."USER"') is not null then
    select count(*) into legacy_users from public."USER";
    select count(*) into mapped_profiles from public.profiles;
  end if;

  if to_regclass('public."ASSESSMENT_SESSIONS"') is not null then
    select count(*) into legacy_sessions from public."ASSESSMENT_SESSIONS";
    select count(*) into mapped_sessions from public.stress_sessions;
  end if;

  select count(*) into orphans
  from auth.users au
  where au.email is not null
    and not exists (select 1 from public.profiles p where p.id = au.id);

  raise notice 'profiles: % (legacy USER rows: %)', mapped_profiles, legacy_users;
  raise notice 'doctor_profiles: %', (select count(*) from public.doctor_profiles);
  raise notice 'stress_sessions: % (legacy ASSESSMENT_SESSIONS rows: %)', mapped_sessions, legacy_sessions;
  raise notice 'auth users without a profile (must be 0): %', orphans;
  raise notice 'unmapped legacy rows: %', (select count(*) from public.migration_report);

  if legacy_users > 0 and mapped_profiles = 0 then
    if exists (select 1 from public.migration_report where legacy_table in ('USER', 'legacy-scan')) then
      raise notice 'profiles mapping was skipped/failed - see migration_report; legacy USER rows left intact.';
    else
      raise exception 'Migration verification failed: legacy USER rows exist but no profiles were created.';
    end if;
  end if;

  if legacy_sessions > 0 and mapped_sessions = 0 then
    if exists (select 1 from public.migration_report where legacy_table in ('ASSESSMENT_SESSIONS', 'legacy-scan')) then
      raise notice 'stress_sessions mapping was skipped/failed - see migration_report; legacy assessment rows left intact.';
    else
      raise exception 'Migration verification failed: legacy ASSESSMENT_SESSIONS rows exist but no stress_sessions were created.';
    end if;
  end if;

  if orphans > 0 then
    raise exception 'Migration verification failed: % auth.users account(s) have no profile row.', orphans;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12b. Grants (run BEFORE the legacy freeze below, so the revoke on legacy
--      tables is the last word for those tables)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Legacy tables: keep the data, stop the clients from using them
-- ---------------------------------------------------------------------------
-- The legacy tables are preserved exactly as they are (no drop, no truncate).
-- They are simply no longer part of the application's read/write path, so the
-- client roles are revoked and RLS is enabled as deny-by-default. Re-run the
-- verification queries above before ever removing a legacy table.

do $$
declare
  t text;
begin
  -- NOTE: GROWTH_LOG is deliberately NOT in this list. It is a MindPlant
  -- application table (policies for authenticated users were created in
  -- section 10), so revoking its privileges would break plant logging.
  foreach t in array array[
    'USER', 'STUDENT_PROFILES', 'DOCTOR_PROFILES', 'ASSESSMENT_SESSIONS',
    'STRESS_ASSESSMENT_RESULTS', 'SURVEY_RESULTS', 'SURVEY_RESPONSES',
    'SURVEY_QUESTION', 'SURVEY_CHOICES', 'HEART_RATE_RECORDS',
    'REACTION_TEST_RESULTS', 'FACIAL_ANALYSIS_RESULTS', 'STRESS_HISTORY',
    'CONSULTATIONS', 'CONSULTATION_REQUESTS', 'CONVERSATIONS', 'MESSAGES',
    'NOTIFICATIONS', 'RECOMMENDATION', 'SESSION_SUGGESTION', 'CONSENT_RECORDS'
  ] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end;
$$;

-- The legacy "USER" table previously allowed users to read their own row; that
-- is superseded by public.profiles. (DROP POLICY still requires the table to
-- exist, hence the guard.)
do $do$
begin
  if to_regclass('public."USER"') is not null then
    drop policy if exists "Users can read their own application profile" on public."USER";
    drop policy if exists "Users can create their own application profile" on public."USER";
    drop policy if exists "Users can update their own application profile" on public."USER";
  end if;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 14. Server-side account provisioning (used by the web admin console)
-- ---------------------------------------------------------------------------
-- The browser never receives a service-role key. The admin UI calls these
-- SECURITY DEFINER functions, which verify that the caller really is an
-- administrator before touching auth.users. Admin accounts can never be
-- created through them.
--
-- GoTrue has gained (and lost) columns on auth.users / auth.identities across
-- releases, so the inserts below only write the columns this project actually
-- has – and they fail loudly if a required (NOT NULL, no default) column is
-- unknown instead of creating a half-built account.

create or replace function public.create_app_user(
  p_email text,
  p_password text,
  p_first_name text default null,
  p_last_name text default null,
  p_role text default 'student'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_role  text := coalesce(nullif(trim(p_role), ''), 'student');
  v_id    uuid;
  v_full  text;
  v_hash  text;
  v_cols  text;
  v_vals  text;
  v_missing text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can create accounts';
  end if;
  if v_role not in ('student', 'doctor') then
    raise exception 'Only student or doctor accounts can be created from the admin console';
  end if;
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'A valid e-mail address is required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception 'An account with this e-mail already exists';
  end if;

  v_id   := gen_random_uuid();
  v_full := nullif(trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '');
  v_hash := crypt(p_password, gen_salt('bf'));

  -- ---- auth.users ---------------------------------------------------------
  select string_agg(quote_ident(x.col), ', ' order by x.ord),
         string_agg(x.val, ', ' order by x.ord)
    into v_cols, v_vals
  from (values
    (1,  'instance_id',         quote_literal('00000000-0000-0000-0000-000000000000') || '::uuid'),
    (2,  'id',                  quote_literal(v_id::text) || '::uuid'),
    (3,  'aud',                 quote_literal('authenticated')),
    (4,  'role',                quote_literal('authenticated')),
    (5,  'email',               quote_literal(lower(p_email))),
    (6,  'encrypted_password',  quote_literal(v_hash)),
    (7,  'email_confirmed_at',  'now()'),
    (8,  'raw_app_meta_data',   quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'),
    (9,  'raw_user_meta_data',  quote_literal(jsonb_build_object(
                                    'first_name', p_first_name,
                                    'last_name', p_last_name,
                                    'full_name', v_full)::text) || '::jsonb'),
    (10, 'created_at',          'now()'),
    (11, 'updated_at',          'now()')
  ) as x(ord, col, val)
  where exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'auth' and c.table_name = 'users' and c.column_name = x.col
  );

  if v_cols is null then
    raise exception 'create_app_user: no usable columns found on auth.users';
  end if;

  select string_agg(c.column_name, ', ' order by c.column_name)
    into v_missing
  from information_schema.columns c
  where c.table_schema = 'auth' and c.table_name = 'users'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and c.is_generated <> 'ALWAYS'
    and coalesce(c.identity_generation, '') <> 'ALWAYS'
    and not exists (
      select 1 from (values ('instance_id'), ('id'), ('aud'), ('role'), ('email'),
                             ('encrypted_password'), ('email_confirmed_at'),
                             ('raw_app_meta_data'), ('raw_user_meta_data'),
                             ('created_at'), ('updated_at')) as k(col)
      where k.col = c.column_name
    );
  if v_missing is not null then
    raise exception 'create_app_user: auth.users has required column(s) this function does not know how to fill: %', v_missing;
  end if;

  execute format('insert into auth.users (%s) values (%s)', v_cols, v_vals);

  -- ---- auth.identities ----------------------------------------------------
  select string_agg(quote_ident(x.col), ', ' order by x.ord),
         string_agg(x.val, ', ' order by x.ord)
    into v_cols, v_vals
  from (values
    (1, 'id',              'gen_random_uuid()'),
    (2, 'user_id',         quote_literal(v_id::text) || '::uuid'),
    (3, 'provider',        quote_literal('email')),
    (4, 'provider_id',     quote_literal(v_id::text)),
    (5, 'identity_data',   quote_literal(format('{"sub": "%s", "email": "%s", "email_verified": true}',
                                                v_id::text, lower(p_email))) || '::jsonb'),
    (6, 'last_sign_in_at', 'now()'),
    (7, 'created_at',      'now()'),
    (8, 'updated_at',      'now()')
  ) as x(ord, col, val)
  where exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'auth' and c.table_name = 'identities' and c.column_name = x.col
  );

  if v_cols is null then
    raise exception 'create_app_user: no usable columns found on auth.identities';
  end if;

  select string_agg(c.column_name, ', ' order by c.column_name)
    into v_missing
  from information_schema.columns c
  where c.table_schema = 'auth' and c.table_name = 'identities'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and c.is_generated <> 'ALWAYS'
    and coalesce(c.identity_generation, '') <> 'ALWAYS'
    and not exists (
      select 1 from (values ('id'), ('user_id'), ('provider'), ('provider_id'),
                             ('identity_data'), ('last_sign_in_at'),
                             ('created_at'), ('updated_at')) as k(col)
      where k.col = c.column_name
    );
  if v_missing is not null then
    raise exception 'create_app_user: auth.identities has required column(s) this function does not know how to fill: %', v_missing;
  end if;

  execute format('insert into auth.identities (%s) values (%s)', v_cols, v_vals);

  -- ---- application profile ------------------------------------------------
  -- The on_auth_user_created trigger has already created the row as a
  -- student; this promotes it (profiles.role can only be changed by an
  -- administrator, which is exactly the caller checked above). The
  -- profiles_ensure_doctor_row trigger then adds the doctor profile.
  insert into public.profiles (id, first_name, last_name, full_name, email, role)
  values (v_id, nullif(coalesce(p_first_name, ''), ''), nullif(coalesce(p_last_name, ''), ''),
          v_full, lower(p_email), v_role)
  on conflict (id) do update set role = excluded.role;

  return v_id;
end;
$$;

-- Admins can confirm an account whose owner never clicked the e-mail link
-- (the project ships with "Confirm email" enabled).
create or replace function public.confirm_app_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can confirm accounts';
  end if;
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = p_user_id;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

create or replace function public.delete_app_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can remove accounts';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;
  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

-- Students can erase their own account from the Privacy & Data screen.
-- Cascades wipe profiles, sessions, appointments, chat, video and
-- notifications; the legacy plant tables no longer cascade (their FK to
-- "USER" was dropped in 6b), so their rows are removed explicitly.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  if to_regclass('public."MIND_PLANT_PROGRESS"') is not null then
    delete from public."MIND_PLANT_PROGRESS" where "USER_ID" = v_uid;
  end if;
  if to_regclass('public."GROWTH_LOG"') is not null then
    delete from public."GROWTH_LOG" where "USER_ID" = v_uid;
  end if;

  delete from auth.users where id = v_uid;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

revoke all on function public.create_app_user(text, text, text, text, text) from public, anon;
revoke all on function public.confirm_app_user(uuid) from public, anon;
revoke all on function public.delete_app_user(uuid) from public, anon;
grant execute on function public.create_app_user(text, text, text, text, text) to authenticated;
grant execute on function public.confirm_app_user(uuid) to authenticated;
grant execute on function public.delete_app_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. Function execution grants
-- ---------------------------------------------------------------------------
grant execute on all functions in schema public to authenticated, service_role;
