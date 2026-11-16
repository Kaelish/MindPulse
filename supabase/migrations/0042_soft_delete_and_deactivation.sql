-- 0042_soft_delete_and_deactivation.sql
-- Completes the soft-delete architecture started in 0035-0041 and converts
-- account deletion into deactivation + reactivation.
--
-- NON-DESTRUCTIVE BY DESIGN
--   * No DROP TABLE, no TRUNCATE, no DELETE statement anywhere in this file.
--   * Every column is added with an existence guard, every policy with
--     `drop policy if exists` / `create policy`, every function with
--     `create or replace`. Re-running the file is safe.
--   * Every new SELECT predicate is `deleted_at IS NULL`. Because the column
--     defaults to NULL, ALL of these filters are no-ops on existing rows:
--     no existing list, dashboard, count or chart changes behaviour until a
--     row is actually soft-deleted or an account is deactivated.
--
-- WHAT IT DOES
--   1. Adds deleted_at / deleted_by to the remaining user-generated tables,
--      plus is_deactivated / deactivated_at on profiles (the account flags).
--   2. Drops the 7 leftover hard-DELETE policies (0041 removed the other 7).
--   3. ANDs `deleted_at IS NULL` into the SELECT policies of those tables,
--      keeping every ownership clause intact. profiles / doctor_profiles keep
--      their self-read and admin-read clauses UNFILTERED on purpose: a
--      deactivated user must still be able to read their own row or the
--      login/reactivation gate breaks, and admins must still be able to open
--      the archived-accounts list.
--   4. Repairs the stress_sessions UPDATE policies whose `USING` clause
--      contained `is_deleted = false`, which made Restore impossible (the
--      archived row no longer matched any UPDATE policy).
--   5. Grants deleted_by on stress_sessions (0030 revoked table-level UPDATE,
--      so without this the archive/restore write fails with permission denied).
--   6. Adds list_deleted_rows(p_table): a security-definer RPC with a strict
--      table allowlist and per-table ownership predicates, so the "Recently
--      Deleted" screens can read archived rows without loosening the normal
--      SELECT policies.
--   7. Rewrites delete_my_account() and delete_app_user() to DEACTIVATE the
--      profile instead of deleting the auth.users row.
--
-- DELIBERATELY EXCLUDED (and why)
--   * consent_records  - immutable consent proof ("never deleted, never edited
--                        by a client", UPDATE grant withheld by 0031). It
--                        already carries withdrawn_at as its own soft state.
--   * assessment_tools - already soft-deletes via status = 'archived'.
--   * activity_log     - append-only audit trail; hiding rows would destroy
--                        the audit trail it exists to keep.
--   * migration_report - internal migration bookkeeping.
--   * verification_codes - ephemeral OTP rows; expired/consumed codes are
--                        purged by the verification-code edge function.
--   * GROWTH_STAGE     - reference/seed data, not user-generated.
--   * legacy uppercase tables ("USER", "SURVEY_RESULTS", ...) - already have
--                        every privilege revoked from anon/authenticated.

-- ===========================================================================
-- 1. COLUMNS
-- ===========================================================================

-- --- profiles: account record + the deactivation flags ---------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'deleted_at') then
    alter table public.profiles add column deleted_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'deleted_by') then
    alter table public.profiles add column deleted_by uuid;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'is_deactivated') then
    alter table public.profiles add column is_deactivated boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'deactivated_at') then
    alter table public.profiles add column deactivated_at timestamptz;
  end if;
end $$;

comment on column public.profiles.is_deactivated is
  'Account deletion sets this instead of removing the auth.users row. Reactivation clears it.';
comment on column public.profiles.deactivated_at is
  'When the account was deactivated; cleared on reactivation.';
comment on column public.profiles.deleted_at is
  'Marks the account as deleted/deactivated for every active-view filter. Cleared on reactivation. Per-record soft deletes the user made earlier are NOT cleared by reactivation.';
comment on column public.profiles.deleted_by is
  'auth.uid() of whoever deactivated the account (self, or an administrator).';

-- --- soft-delete columns for the remaining domain tables -------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'doctor_profiles'
                   and column_name = 'deleted_at') then
    alter table public.doctor_profiles add column deleted_at timestamptz;
    alter table public.doctor_profiles add column deleted_by uuid;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'appointments'
                   and column_name = 'deleted_at') then
    alter table public.appointments add column deleted_at timestamptz;
    alter table public.appointments add column deleted_by uuid;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'chat_messages'
                   and column_name = 'deleted_at') then
    alter table public.chat_messages add column deleted_at timestamptz;
    alter table public.chat_messages add column deleted_by uuid;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'video_sessions'
                   and column_name = 'deleted_at') then
    alter table public.video_sessions add column deleted_at timestamptz;
    alter table public.video_sessions add column deleted_by uuid;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'payments'
                   and column_name = 'deleted_at') then
    alter table public.payments add column deleted_at timestamptz;
    alter table public.payments add column deleted_by uuid;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'consultation_notes'
                   and column_name = 'deleted_at') then
    alter table public.consultation_notes add column deleted_at timestamptz;
    alter table public.consultation_notes add column deleted_by uuid;
  end if;

  -- MIND_PLANT_PROGRESS: only alter if the table actually exists in this DB.
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'MIND_PLANT_PROGRESS') then
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'MIND_PLANT_PROGRESS'
                     and column_name = 'deleted_at') then
      alter table public."MIND_PLANT_PROGRESS" add column deleted_at timestamptz;
      alter table public."MIND_PLANT_PROGRESS" add column deleted_by uuid;
    end if;
  end if;

  -- GROWTH_LOG: only alter if the table actually exists in this DB.
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'GROWTH_LOG') then
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'GROWTH_LOG'
                     and column_name = 'deleted_at') then
      alter table public."GROWTH_LOG" add column deleted_at timestamptz;
      alter table public."GROWTH_LOG" add column deleted_by uuid;
    end if;
  end if;
end $$;

-- --- deleted_by on the five tables 0035-0039 already soft-deleted ----------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'stress_sessions'
                   and column_name = 'deleted_by') then
    alter table public.stress_sessions add column deleted_by uuid;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'recommendations'
                   and column_name = 'deleted_by') then
    alter table public.recommendations add column deleted_by uuid;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'notifications'
                   and column_name = 'deleted_by') then
    alter table public.notifications add column deleted_by uuid;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'patient_files'
                   and column_name = 'deleted_by') then
    alter table public.patient_files add column deleted_by uuid;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'doctor_suggestions'
                   and column_name = 'deleted_by') then
    alter table public.doctor_suggestions add column deleted_by uuid;
  end if;
end $$;

-- ===========================================================================
-- 2. INDEXES for the Recently Deleted screens (partial, so they stay small)
-- ===========================================================================
create index if not exists profiles_deleted_at_idx        on public.profiles (deleted_at)        where deleted_at is not null;
create index if not exists profiles_deactivated_idx       on public.profiles (is_deactivated)     where is_deactivated = true;
create index if not exists appointments_deleted_at_idx    on public.appointments (deleted_at)     where deleted_at is not null;
create index if not exists chat_messages_deleted_at_idx   on public.chat_messages (deleted_at)    where deleted_at is not null;
create index if not exists video_sessions_deleted_at_idx  on public.video_sessions (deleted_at)   where deleted_at is not null;
create index if not exists payments_deleted_at_idx        on public.payments (deleted_at)         where deleted_at is not null;
create index if not exists consultation_notes_deleted_at_idx on public.consultation_notes (deleted_at) where deleted_at is not null;
create index if not exists doctor_profiles_deleted_at_idx on public.doctor_profiles (deleted_at)  where deleted_at is not null;

-- ===========================================================================
-- 3. HARD DELETE DISABLED: drop the 7 DELETE policies 0041 did not cover.
--    (0041 already dropped recommendations/notifications/patient_files/
--    doctor_suggestions/stress_sessions/assessment_tools DELETE policies.)
-- ===========================================================================
drop policy if exists "profiles_delete_admin"           on public.profiles;
drop policy if exists "doctor_profiles_delete_admin"    on public.doctor_profiles;
drop policy if exists "appointments_delete_admin"       on public.appointments;
drop policy if exists "chat_messages_delete_admin"      on public.chat_messages;
drop policy if exists "video_sessions_delete_admin"     on public.video_sessions;
drop policy if exists "payments_delete_admin"           on public.payments;
drop policy if exists "consultation_notes_delete_admin" on public.consultation_notes;

-- ===========================================================================
-- 4. SELECT POLICIES: active views only.
--
--    Ownership clauses are preserved verbatim; `deleted_at IS NULL` is ANDed
--    into the branches that face other people's data. Self-read and admin-read
--    stay unfiltered so that:
--      * a deactivated user can still read their own row (the reactivation
--        dialog needs is_deactivated before it can offer to clear it), and
--      * an administrator can still open the "deactivated accounts" list.
-- ===========================================================================

-- profiles: the ONLY change is that the public "doctor directory" branch now
-- requires an active row. Appointment-linked doctors keep read access to a
-- patient they already treat, so soft-deleting/deactivating an account cannot
-- null-out the name on an appointment the doctor is already viewing.
drop policy if exists "profiles_select_self_admin_link" on public.profiles;
create policy "profiles_select_self_admin_link" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.has_appointment_with(id)
    or (deleted_at is null and role = 'doctor')
  );

-- doctor_profiles: directory branch additionally requires the backing profile
-- to be active, so a deactivated doctor disappears from every booking list.
drop policy if exists "doctor_profiles_select" on public.doctor_profiles;
create policy "doctor_profiles_select" on public.doctor_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      doctor_profiles.deleted_at is null
      and is_verified
      and exists (
        select 1 from public.profiles p
        where p.id = doctor_profiles.user_id
          and p.role = 'doctor'
          and p.deleted_at is null
          and p.is_deactivated = false
      )
    )
  );

drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select" on public.appointments
  for select to authenticated
  using (
    (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin())
    and deleted_at is null
  );

drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select to authenticated
  using (
    (patient_id = auth.uid() or clinician_id = auth.uid() or public.is_admin())
    and deleted_at is null
  );

-- video_sessions: administrators were already excluded on purpose (a Daily.co
-- token is a participant credential). That stays exactly as it was.
drop policy if exists "video_sessions_select" on public.video_sessions;
create policy "video_sessions_select" on public.video_sessions
  for select to authenticated
  using (
    (patient_id = auth.uid() or doctor_id = auth.uid())
    and deleted_at is null
  );

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select to authenticated
  using (
    (
      patient_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.appointments a
        where a.id = appointment_id and a.doctor_id = auth.uid()
      )
    )
    and deleted_at is null
  );

-- consultation_notes: 0025 narrowed this to doctor + clinic admin only.
-- That scope is preserved; only the soft-delete predicate is added.
drop policy if exists "consultation_notes_select" on public.consultation_notes;
create policy "consultation_notes_select" on public.consultation_notes
  for select to authenticated
  using (
    (doctor_id = auth.uid() or public.is_admin())
    and deleted_at is null
  );

-- plant tables (0011 / 0001) — policies are only (re-)created when the
-- tables exist; on databases that never ran migration 0001/0011 the
-- DO blocks above already skipped the column additions safely.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'MIND_PLANT_PROGRESS') then
    drop policy if exists "plant_progress_select_own" on public."MIND_PLANT_PROGRESS";
    execute $p$
      create policy "plant_progress_select_own" on public."MIND_PLANT_PROGRESS"
        for select to authenticated
        using (("USER_ID" = auth.uid() or public.is_admin()) and deleted_at is null)
    $p$;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'GROWTH_LOG') then
    drop policy if exists "growth_log_select_own" on public."GROWTH_LOG";
    execute $p$
      create policy "growth_log_select_own" on public."GROWTH_LOG"
        for select to authenticated
        using (("USER_ID" = auth.uid() or public.is_admin()) and deleted_at is null)
    $p$;
  end if;
end $$;

-- The five tables 0035-0041 already filter on `is_deleted = false`. Adding
-- `deleted_at is null` is redundant (both are written together) and would only
-- create a second source of truth, so those policies are left untouched.

-- ===========================================================================
-- 5. RESTORE: stress_sessions UPDATE policies could never reach an archived
--    row because `USING` contained `is_deleted = false`. Ownership is kept, the
--    stale predicate is removed, so the owner/admin/doctor may both archive and
--    restore. (The other four soft-delete tables never had this predicate.)
-- ===========================================================================
drop policy if exists "stress_sessions_update_self" on public.stress_sessions;
create policy "stress_sessions_update_self" on public.stress_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "stress_sessions_update_admin" on public.stress_sessions;
create policy "stress_sessions_update_admin" on public.stress_sessions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "stress_sessions_update_review" on public.stress_sessions;
create policy "stress_sessions_update_review" on public.stress_sessions
  for update to authenticated
  using (
    public.current_app_role() = 'doctor'
    and public.has_appointment_with(user_id)
  )
  with check (
    public.current_app_role() = 'doctor'
    and public.has_appointment_with(user_id)
  );

-- 0030 revoked table-level UPDATE and 0040/0041 re-granted only
-- (is_deleted, deleted_at). Restore writes deleted_by as well.
grant update (is_deleted, deleted_at, deleted_by) on public.stress_sessions to authenticated;

-- ===========================================================================
-- 6. The one patient-facing read path for consultation notes is a
--    security-definer function, so RLS never applies to it - the soft-delete
--    predicate has to be added inside the function body.
-- ===========================================================================
create or replace function public.get_patient_consultation_note(p_appointment_id uuid)
returns table (
  appointment_id    uuid,
  doctor_id         uuid,
  patient_note      text,
  psychologist      text,
  session_date      text,
  signature         text,
  signed_at         timestamptz,
  updated_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cn.appointment_id,
    cn.doctor_id,
    cn.patient_note,
    cn.psychologist,
    cn.session_date,
    cn.signature,
    cn.signed_at,
    cn.updated_at
  from public.consultation_notes cn
  where cn.appointment_id = p_appointment_id
    and cn.patient_id = auth.uid()
    and cn.patient_note_published
    and btrim(cn.patient_note) <> ''
    and cn.deleted_at is null;
$$;

revoke execute on function public.get_patient_consultation_note(uuid) from public;
revoke execute on function public.get_patient_consultation_note(uuid) from anon;
grant execute on function public.get_patient_consultation_note(uuid) to authenticated;

-- ===========================================================================
-- 7. list_deleted_rows(p_table)
--    Trash read path. SECURITY DEFINER so it can read rows the normal SELECT
--    policies hide, with the ownership check performed explicitly per table
--    against a hard-coded allowlist - no user input ever reaches the SQL.
--    Returns jsonb so one function serves every table; callers already map
--    snake_case rows onto their own DTOs.
-- ===========================================================================
create or replace function public.list_deleted_rows(p_table text)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_sql text;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  v_sql := case p_table
    when 'stress_sessions' then
      'select to_jsonb(t) from public.stress_sessions t
        where t.deleted_at is not null and (t.user_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'notifications' then
      'select to_jsonb(t) from public.notifications t
        where t.deleted_at is not null and (t.user_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'recommendations' then
      'select to_jsonb(t) from public.recommendations t
        where t.deleted_at is not null
          and (t.student_id = $1 or t.doctor_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'patient_files' then
      'select to_jsonb(t) from public.patient_files t
        where t.deleted_at is not null
          and (t.patient_id = $1 or t.doctor_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'doctor_suggestions' then
      'select to_jsonb(t) from public.doctor_suggestions t
        where t.deleted_at is not null and (t.doctor_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'appointments' then
      'select to_jsonb(t) from public.appointments t
        where t.deleted_at is not null
          and (t.patient_id = $1 or t.doctor_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'chat_messages' then
      'select to_jsonb(t) from public.chat_messages t
        where t.deleted_at is not null
          and (t.patient_id = $1 or t.clinician_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'video_sessions' then
      'select to_jsonb(t) from public.video_sessions t
        where t.deleted_at is not null
          and (t.patient_id = $1 or t.doctor_id = $1)
        order by t.deleted_at desc'
    when 'payments' then
      'select to_jsonb(t) from public.payments t
        where t.deleted_at is not null and (t.patient_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'consultation_notes' then
      'select to_jsonb(t) from public.consultation_notes t
        where t.deleted_at is not null and (t.doctor_id = $1 or public.is_admin())
        order by t.deleted_at desc'
    when 'profiles' then
      -- Deactivated / deleted ACCOUNTS. Administrator-only: a normal user has
      -- no business listing other peoples accounts.
      'select to_jsonb(t) from public.profiles t
        where t.deleted_at is not null and public.is_admin()
        order by t.deleted_at desc'
    else null
  end;

  if v_sql is null then
    raise exception 'Recently Deleted is not supported for table %', p_table;
  end if;

  return query execute v_sql using v_uid;
end;
$$;

revoke all on function public.list_deleted_rows(text) from public;
revoke all on function public.list_deleted_rows(text) from anon;
grant execute on function public.list_deleted_rows(text) to authenticated;

-- ===========================================================================
-- 8. ACCOUNT DELETION = DEACTIVATION.
--    Both functions previously ran `delete from auth.users`, which cascaded
--    away profiles, doctor_profiles and every linked row. They now flip the
--    profile flags instead. auth.users is never touched, so the person can
--    still sign in and be offered reactivation.
-- ===========================================================================

-- Students: "Delete Account" on the Privacy & Data screen.
-- The old body also wiped MIND_PLANT_PROGRESS / GROWTH_LOG; those rows are now
-- preserved with the rest of the account and come back on reactivation.
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

  update public.profiles
     set is_deactivated = true,
         deactivated_at = now(),
         deleted_at      = now(),
         deleted_by      = v_uid
   where id = v_uid;

  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Administrators: deny a pending registration / remove an account.
-- Same deactivation semantics; the original `is_admin()` and "not yourself"
-- guards are preserved exactly.
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

  update public.profiles
     set is_deactivated = true,
         deactivated_at = now(),
         deleted_at      = now(),
         deleted_by      = auth.uid()
   where id = p_user_id;

  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

revoke all on function public.delete_app_user(uuid) from public, anon;
grant execute on function public.delete_app_user(uuid) to authenticated;

-- ===========================================================================
-- 9. migration_report marker (same idempotent pattern as 0035-0041)
-- ===========================================================================
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'soft_delete_architecture', null, null,
       'applied 0042: added deleted_at/deleted_by to 9 tables + deleted_by to 5; is_deactivated/deactivated_at on profiles; dropped 7 DELETE policies; filtered 9 SELECT policies; repaired stress_sessions restore; added list_deleted_rows RPC; delete_my_account/delete_app_user now deactivate instead of deleting auth.users'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'soft_delete_architecture'
    and problem like 'applied 0042%'
);
