-- 0041_soft_delete_rls_fixes.sql
-- Corrections to the RLS half of migrations 0035-0039. Runs AFTER
-- 0040_fix_stress_sessions_soft_delete.sql (which repairs stress_sessions
-- alone) and covers the same ground for stress_sessions plus the other five
-- tables:
--   1. Drops the DELETE policies those migrations forgot to remove, so hard
--      delete is genuinely disabled at the database level on all six tables.
--   2. Restores the ORIGINAL ownership predicates on SELECT and UPDATE while
--      ANDing `is_deleted = false` into every SELECT. 0035-0039 replaced the
--      ownership clauses outright, which both widened access (any authenticated
--      user could read every patient file / suggestion) and closed it wrongly
--      (admins and appointment-linked doctors lost their stress_sessions rows).
--   3. Restores ownership-checked UPDATE policies so legitimate edits keep
--      working: marking a notification read, completing a recommendation,
--      replying to a suggestion. The original 0035-0039
--      `with check (is_deleted = true)` rejected every write that was not an
--      archive.
--   4. Re-grants the two soft-delete columns on stress_sessions, which 0030
--      revoked at table level (client-side archive failed with
--      "permission denied" without them).

-- ---------------------------------------------------------------------------
-- 1. Hard delete disabled: drop every DELETE policy on the six tables.
-- ---------------------------------------------------------------------------
drop policy if exists "recommendations_delete" on public.recommendations;
drop policy if exists "notifications_delete" on public.notifications;
drop policy if exists "patient_files_delete" on public.patient_files;
drop policy if exists "doctor_suggestions_delete" on public.doctor_suggestions;
drop policy if exists "stress_sessions_delete_own" on public.stress_sessions;
drop policy if exists "stress_sessions_delete_admin" on public.stress_sessions;
drop policy if exists "assessment_tools_delete_admin" on public.assessment_tools;

-- ---------------------------------------------------------------------------
-- 2. SELECT: original scope, plus archived rows hidden from every role.
-- ---------------------------------------------------------------------------
drop policy if exists "recommendations_select" on public.recommendations;
create policy "recommendations_select" on public.recommendations
  for select to authenticated
  using ((student_id = auth.uid() or doctor_id = auth.uid()) and is_deleted = false);

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using ((user_id = auth.uid() or public.is_admin()) and is_deleted = false);

drop policy if exists "patient_files_select" on public.patient_files;
create policy "patient_files_select" on public.patient_files
  for select to authenticated
  using ((patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin()) and is_deleted = false);

drop policy if exists "doctor_suggestions_select" on public.doctor_suggestions;
create policy "doctor_suggestions_select" on public.doctor_suggestions
  for select to authenticated
  using ((doctor_id = auth.uid() or public.is_admin()) and is_deleted = false);

drop policy if exists "stress_sessions_select" on public.stress_sessions;
create policy "stress_sessions_select" on public.stress_sessions
  for select to authenticated
  using (
    is_deleted = false
    and (
      user_id = auth.uid()
      or public.is_admin()
      or public.has_appointment_with(user_id)
    )
  );

-- assessment_tools_select is unchanged: soft delete there is status-based
-- (`status = 'active' or public.is_admin()` from 0005).

-- ---------------------------------------------------------------------------
-- 3. UPDATE: ownership-checked (matches the pre-0035 policies). Any edit the
--    owner or admin legitimately performs passes, including the archive write;
--    cross-account writes stay blocked. No DELETE policies are recreated.
-- ---------------------------------------------------------------------------
drop policy if exists "recommendations_update" on public.recommendations;
create policy "recommendations_update" on public.recommendations
  for update to authenticated
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "patient_files_update" on public.patient_files;
create policy "patient_files_update" on public.patient_files
  for update to authenticated
  using (doctor_id = auth.uid() or public.is_admin())
  with check (doctor_id = auth.uid() or public.is_admin());

-- Admins reply / change status (0022 semantics, restored) …
drop policy if exists "doctor_suggestions_update" on public.doctor_suggestions;
create policy "doctor_suggestions_update" on public.doctor_suggestions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- … and doctors withdraw (archive) their own suggestions, which previously
-- went through the now-removed DELETE policy.
drop policy if exists "doctor_suggestions_withdraw" on public.doctor_suggestions;
create policy "doctor_suggestions_withdraw" on public.doctor_suggestions
  for update to authenticated
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- stress_sessions: 0039's "stress_sessions_update" demanded
-- `with check (is_deleted = true)` on every write. Drop it — the original
-- policies still in force cover all legitimate updates:
--   stress_sessions_update_self  (0001): owner / admin
--   stress_sessions_update_review(0030): appointment-linked doctor, review cols
-- The owner policy is also what permits the patient's archive write.
drop policy if exists "stress_sessions_update" on public.stress_sessions;

-- 0030 revoked table-level UPDATE and granted only (reviewed_at, reviewed_by).
-- Grant the two soft-delete columns so "Hide Assessment History" can run;
-- every other column stays non-writable by clients (deviation C-4 intact).
grant update (is_deleted, deleted_at) on public.stress_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- 4. migration_report marker (same idempotent pattern as 0035-0039)
-- ---------------------------------------------------------------------------
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'rls_soft_delete', null, null,
       'applied 0041: dropped leftover DELETE policies on 6 tables; restored ownership-scoped SELECT/UPDATE with is_deleted filters; granted soft-delete columns on stress_sessions'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'rls_soft_delete'
    and problem like 'applied 0041%'
);
