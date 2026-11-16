-- 0049_notification_archive_restore_rpc.sql
--
-- Archive/restore RPCs provide a stable write path if an older notification
-- RLS policy remains in a deployed database. They are deliberately scoped to
-- the authenticated owner and never expose arbitrary row updates.

create or replace function public.archive_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
     set is_deleted = true,
         deleted_at = now(),
         deleted_by = auth.uid()
   where id = p_notification_id
     and user_id = auth.uid();

  if not found then
    raise exception 'Notification not found or not owned by the current user';
  end if;
end;
$$;

create or replace function public.restore_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
     set is_deleted = false,
         deleted_at = null,
         deleted_by = null
   where id = p_notification_id
     and user_id = auth.uid();

  if not found then
    raise exception 'Notification not found or not owned by the current user';
  end if;
end;
$$;

revoke all on function public.archive_notification(uuid) from public, anon;
revoke all on function public.restore_notification(uuid) from public, anon;
grant execute on function public.archive_notification(uuid) to authenticated;
grant execute on function public.restore_notification(uuid) to authenticated;

