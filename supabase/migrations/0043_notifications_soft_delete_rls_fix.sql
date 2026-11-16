-- 0043_notifications_soft_delete_rls_fix.sql
-- Ensures notifications soft-delete (is_deleted) works correctly.
-- Dismissing a notification sets is_deleted = true instead of destroying the row.
-- Idempotent: safe to re-run on any database state.

-- 1. Add soft-delete columns if missing (0037 / 0042)
alter table if exists public.notifications
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists notifications_is_deleted_idx
  on public.notifications (is_deleted, deleted_at);

-- 2. Ensure RLS is enabled
alter table public.notifications enable row level security;

-- 3. SELECT: hide soft-deleted rows; owners and admins can read active rows
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using ((user_id = auth.uid() or public.is_admin()) and is_deleted = false);

-- 4. UPDATE: owners and admins may update their own rows, including setting
--    is_deleted = true (soft-delete / archive) AND is_deleted = false (restore).
--    The policy does not gate on is_deleted = false in the `using` clause so
--    already-archived rows can be un-archived (restored). The with-check only
--    verifies ownership, not the new column values.
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- 5. DELETE: no policy — hard delete is disabled at the database level.
drop policy if exists "notifications_delete" on public.notifications;

-- 6. Column-level grants so the client can write the soft-delete columns
--    even if table-level privileges were revoked.
grant update (is_deleted, deleted_at, deleted_by) on public.notifications to authenticated;

-- 7. migration_report marker
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'notifications', null, null,
       'applied 0043: ensured soft-delete columns and RLS policies on notifications; hard delete disabled; UPDATE permits archive (is_deleted = true)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'notifications'
    and problem like 'applied 0043%'
);
