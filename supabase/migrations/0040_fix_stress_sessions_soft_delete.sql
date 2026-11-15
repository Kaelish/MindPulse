-- 0040_fix_stress_sessions_soft_delete.sql
-- Fix RLS policies and column grants for soft-delete on stress_sessions.
--
-- Migration 0039 replaced stress_sessions_select with a stricter policy that
-- dropped admin/doctor-with-appointment access. Migration 0030 restricts
-- client UPDATE to only (reviewed_at, reviewed_by), blocking is_deleted writes.
-- This migration repairs both issues.

-- 1. Restore SELECT access: admins and doctors with appointment links can still
--    see sessions, but soft-deleted rows are excluded.
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

-- 2. Restore UPDATE access for owners on non-deleted rows. The owner can
--    soft-delete (is_deleted = true) or update other fields on their own rows.
--    Already-deleted rows cannot be modified (no undelete).
drop policy if exists "stress_sessions_update_self" on public.stress_sessions;
create policy "stress_sessions_update_self" on public.stress_sessions
  for update to authenticated
  using (user_id = auth.uid() and is_deleted = false)
  with check (user_id = auth.uid());

-- 3. Restore UPDATE access for admins on non-deleted rows.
drop policy if exists "stress_sessions_update_admin" on public.stress_sessions;
create policy "stress_sessions_update_admin" on public.stress_sessions
  for update to authenticated
  using (public.is_admin() and is_deleted = false)
  with check (public.is_admin());

-- 4. Keep the review-column UPDATE policy (migration 0030) but add is_deleted
--    = false so doctors can't mark an already-deleted session as reviewed.
drop policy if exists "stress_sessions_update_review" on public.stress_sessions;
create policy "stress_sessions_update_review" on public.stress_sessions
  for update to authenticated
  using (
    public.current_app_role() = 'doctor'
    and public.has_appointment_with(user_id)
    and is_deleted = false
  )
  with check (
    public.current_app_role() = 'doctor'
    and public.has_appointment_with(user_id)
  );

-- 5. Grant client UPDATE permission on is_deleted and deleted_at columns.
--    Migration 0030 revoked all UPDATE and only granted (reviewed_at, reviewed_by).
--    Soft-delete requires writing is_deleted and deleted_at.
grant update (is_deleted, deleted_at) on public.stress_sessions to authenticated;

-- 6. Remove hard DELETE policies: soft-delete only. Keep insert policy intact.
drop policy if exists "stress_sessions_delete_own" on public.stress_sessions;
drop policy if exists "stress_sessions_delete_admin" on public.stress_sessions;

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'stress_sessions', null, null,
       'applied 0040: fixed RLS policies for soft-delete on stress_sessions; restored admin/doctor select access; granted is_deleted/deleted_at update; removed DELETE policies'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'stress_sessions'
    and problem like 'applied 0040%'
);
