-- 0046_notifications_soft_delete_consolidation.sql
--
-- ONE-TIME, IDEMPOTENT consolidation of everything the notification
-- soft-delete/restore flow needs, in a single file you can run once in the
-- Supabase SQL Editor. It restates the end-state that 0037 / 0041 / 0042 /
-- 0043 / 0045 build up across five separate files, so a database that only
-- ever ran part of that chain still ends up correct.
--
-- Guarantees after running:
--   * is_deleted / deleted_at / deleted_by exist on public.notifications
--   * every archived notification is restored back into the active feed
--   * RLS is on; SELECT hides archived rows; UPDATE is NOT gated on
--     is_deleted (otherwise archived rows could never be restored again)
--   * no DELETE policy exists -> hard delete is impossible from the client
--   * authenticated can write the three soft-delete columns
--
-- SAFETY: contains no DELETE, no TRUNCATE and no DROP TABLE. Every write is
-- an ALTER / CREATE OR REPLACE / DROP POLICY or an UPDATE that only un-flags
-- rows. public.notifications is never destroyed.
--
-- *** STEP 3 IS A ONE-TIME BASELINE RESET. ***
-- It un-archives EVERY currently dismissed notification. That is intentional
-- here (it repairs a state where the double is_deleted = false filter left
-- users with an empty feed and no way back). Do NOT re-run this file later,
-- or it will un-archive notifications users have deliberately dismissed.
-- Everything else in the file is safe to re-run as often as you like.

-- ===========================================================================
-- 1. COLUMNS — ensure the soft-delete columns exist (0037 / 0042)
-- ===========================================================================
alter table if exists public.notifications
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

comment on column public.notifications.is_deleted is
  'Soft-delete flag: TRUE archives the row out of every active feed without destroying it.';
comment on column public.notifications.deleted_at is
  'When the row was archived; NULL means it is active. Also the Recently Deleted sort key.';
comment on column public.notifications.deleted_by is
  'Account that archived the row; NULL once restored.';

-- Partial index keeps both the active feed and the trash list cheap.
create index if not exists notifications_is_deleted_idx
  on public.notifications (is_deleted, deleted_at);

-- ===========================================================================
-- 2. RLS — must be on, otherwise the policies below never evaluate
-- ===========================================================================
alter table public.notifications enable row level security;

-- ===========================================================================
-- 3. RESTORE — bring every archived notification back into the active feed
--    (ONE-TIME baseline; see the warning in the header)
-- ===========================================================================
update public.notifications
   set is_deleted = false,
       deleted_at = null,
       deleted_by = null
 where is_deleted = true;

-- ===========================================================================
-- 4. SELECT — owners and admins read ACTIVE rows only.
--    The is_deleted = false clause stays: active feeds must hide archived
--    rows. Trash reads go through list_deleted_rows() instead (0042).
-- ===========================================================================
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using ((user_id = auth.uid() or public.is_admin()) and is_deleted = false);

-- ===========================================================================
-- 5. UPDATE — owners and admins, deliberately NOT gated on is_deleted.
--    Gating the USING clause on is_deleted = false would make the restore
--    write fail on exactly the rows it targets: an archived row is invisible
--    to a policy that only allows updating active rows.
--    The WITH CHECK only re-verifies ownership, so both archive
--    (is_deleted = true) and restore (is_deleted = false) are permitted.
-- ===========================================================================
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- 6. DELETE — no policy. Hard delete stays disabled at the database level,
--    so a stray .delete() on this table fails instead of destroying rows.
-- ===========================================================================
drop policy if exists "notifications_delete" on public.notifications;

-- ===========================================================================
-- 7. GRANTS — column-level write access for the soft-delete columns, so the
--    client can archive and restore even if table privileges were narrowed.
-- ===========================================================================
grant update (is_deleted, deleted_at, deleted_by) on public.notifications to authenticated;

-- ===========================================================================
-- 8. REPORT MARKER
-- ===========================================================================
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'notifications', null, null,
       'applied 0046: consolidated notifications soft-delete — columns ensured, archived rows restored, RLS SELECT hides archived, UPDATE permits restore, DELETE policy dropped, column grants applied'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'notifications'
    and problem like 'applied 0046%'
);
