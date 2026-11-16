-- 0044_restore_notifications_and_fix_rls.sql
-- Brings back missing notifications: restores every soft-deleted notification
-- (is_deleted = false) and ensures RLS + grants are correct so the doctor and
-- admin web portals and the mobile apps can read and soft-delete again.
--
-- SAFE / NON-DESTRUCTIVE:
--   * No DELETE, no DROP, no TRUNCATE.
--   * Only UPDATEs is_deleted back to false on existing rows.
--   * IF NOT EXISTS guards on columns; DROP POLICY IF EXISTS on policies.
--   * Re-running is safe (idempotent via migration_report).

-- 1. Ensure soft-delete columns exist (in case 0037/0042 never ran)
alter table if exists public.notifications
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

-- 2. Restore every soft-deleted notification so they reappear in feeds.
--    This is the key step: all reads filter is_deleted = false, so any row
--    that was archived is invisible until cleared here.
update public.notifications
   set is_deleted = false,
       deleted_at = null,
       deleted_by = null
 where is_deleted = true;

-- 3. Ensure RLS is enabled
alter table public.notifications enable row level security;

-- 4. SELECT: owners and admins read only non-deleted rows
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using ((user_id = auth.uid() or public.is_admin()) and is_deleted = false);

-- 5. UPDATE: owners and admins may archive (is_deleted = true) or restore
--    (is_deleted = false) their own rows. The `using` clause does NOT gate on
--    is_deleted = false so already-archived rows can be un-archived.
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- 6. DELETE: no policy — hard delete remains disabled at the database level.
drop policy if exists "notifications_delete" on public.notifications;

-- 7. Column-level grants so clients can write soft-delete columns even if
--    table-level privileges were revoked elsewhere.
grant update (is_deleted, deleted_at, deleted_by) on public.notifications to authenticated;

-- 8. migration_report marker (idempotent)
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'notifications', null, null,
       'applied 0044: restored all soft-deleted notifications (is_deleted=false); fixed RLS SELECT/UPDATE; hard delete disabled; grants ensured'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'notifications'
    and problem like 'applied 0044%'
);
