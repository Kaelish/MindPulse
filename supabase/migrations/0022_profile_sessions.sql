create or replace function public.revoke_profile_auth_session(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_user_id is null or p_session_id is null then
    return false;
  end if;

  delete from auth.sessions
   where user_id = p_user_id
     and id = p_session_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.revoke_profile_auth_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_profile_auth_session(uuid, uuid) to service_role;

drop policy if exists "users manage their private profile session channel" on realtime.messages;
create policy "users manage their private profile session channel"
  on realtime.messages
  for all
  to authenticated
  using (
    auth.uid() is not null
    and realtime.topic() = 'profile-sessions:' || auth.uid()::text
  )
  with check (
    auth.uid() is not null
    and realtime.topic() = 'profile-sessions:' || auth.uid()::text
  );