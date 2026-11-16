-- 0048_rebuild_notifications_rls_policies.sql
--
-- Some databases may contain notification policies under names other than
-- notifications_update. PostgreSQL combines policies, so one stale WITH CHECK
-- policy can still reject the archive UPDATE. Remove every policy on this
-- table, then recreate the complete intended policy set.

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
  loop
    execute format('drop policy if exists %I on public.notifications', policy_name);
  end loop;
end
$$;

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications
  for select to authenticated
  using (
    (user_id = auth.uid() or public.is_admin())
    and is_deleted = false
  );

create policy "notifications_insert" on public.notifications
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_appointment_with(user_id)
  );

create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

grant select, insert, update on public.notifications to authenticated;
grant update (is_deleted, deleted_at, deleted_by) on public.notifications to authenticated;

