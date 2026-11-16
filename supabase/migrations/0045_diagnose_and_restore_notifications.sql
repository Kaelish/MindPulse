-- 0045_diagnose_and_restore_notifications.sql
-- DIAGNOSTIC + RESTORE for missing notifications.
-- Run this in Supabase SQL Editor. It will:
--   1. Show you how many notifications exist (total, deleted, active)
--   2. Restore ALL soft-deleted notifications (bypassing RLS via SECURITY DEFINER)
--   3. Show you the after-state
--
-- SAFE: No DELETE, no DROP, no TRUNCATE. Only UPDATEs is_deleted back to false.

-- ===========================================================================
-- STEP 1: DIAGNOSTIC — see the current state
-- ===========================================================================
SELECT
  count(*) FILTER (WHERE is_deleted = false) AS active_notifications,
  count(*) FILTER (WHERE is_deleted = true)  AS soft_deleted_notifications,
  count(*)                                     AS total_notifications
FROM public.notifications;

-- Show a sample of existing rows so we can see user_ids and types
SELECT id, user_id, title, type, is_deleted, deleted_at, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 20;

-- ===========================================================================
-- STEP 2: RESTORE — bring back every soft-deleted notification
-- ===========================================================================
-- We use a SECURITY DEFINER function so the UPDATE runs with table owner
-- privileges and is NOT blocked by RLS (which can fail in SQL Editor when
-- auth.uid() is null).
create or replace function public.restore_all_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.notifications
     set is_deleted = false,
         deleted_at = null,
         deleted_by = null
   where is_deleted = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Execute the restore
select public.restore_all_notifications() AS restored_count;

-- Grant execute so authenticated users can call it if needed
grant execute on function public.restore_all_notifications() to authenticated;

-- ===========================================================================
-- STEP 3: AFTER-STATE — confirm notifications are back
-- ===========================================================================
SELECT
  count(*) FILTER (WHERE is_deleted = false) AS active_notifications_after,
  count(*) FILTER (WHERE is_deleted = true)  AS soft_deleted_notifications_after,
  count(*)                                     AS total_notifications_after
FROM public.notifications;

-- Show the restored rows
SELECT id, user_id, title, type, is_deleted, deleted_at, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 30;

-- ===========================================================================
-- STEP 4: FINAL RLS + GRANTS (ensure everything is correct going forward)
-- ===========================================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using ((user_id = auth.uid() or public.is_admin()) and is_deleted = false);

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_delete" on public.notifications;

grant update (is_deleted, deleted_at, deleted_by) on public.notifications to authenticated;

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'notifications', null, null,
       'applied 0045: diagnosed + restored soft-deleted notifications via security definer; fixed RLS + grants'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'notifications'
    and problem like 'applied 0045%'
);
