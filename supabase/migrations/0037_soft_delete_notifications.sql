-- 0037_soft_delete_notifications.sql
-- Replace hard DELETE on notifications with soft delete (is_deleted).
-- Dismissing a notification hides it instead of destroying the row.

alter table public.notifications
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists notifications_is_deleted_idx
  on public.notifications (is_deleted, deleted_at);

-- RLS: SELECT filters out soft-deleted rows.
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using (is_deleted = false and user_id = auth.uid());

-- RLS: UPDATE permits soft-delete (setting is_deleted = true) and other field
-- updates on non-deleted rows. Cannot update already-deleted rows (no undelete).
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() and is_deleted = false)
  with check (user_id = auth.uid());

-- No DELETE policy: hard delete is disabled.

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'notifications', null, null,
       'applied 0037: soft delete (is_deleted/deleted_at) on notifications; DELETE disabled, UPDATE-only archive'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'notifications'
    and problem like 'applied 0037%'
);
