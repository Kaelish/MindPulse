-- 0047_fix_notification_archive_update_rls.sql
--
-- The notification dismiss action is an UPDATE, never a DELETE. If the
-- database still has an older UPDATE policy whose WITH CHECK requires
-- is_deleted = false, setting is_deleted = true fails with:
-- "new row violates row-level security policy".
--
-- This migration is safe to run repeatedly. It preserves the active-feed
-- filter while allowing owners/admins to archive and restore their rows.

alter table if exists public.notifications
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using (
    (user_id = auth.uid() or public.is_admin())
    and is_deleted = false
  );

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_delete" on public.notifications;

grant update (is_deleted, deleted_at, deleted_by)
  on public.notifications to authenticated;

