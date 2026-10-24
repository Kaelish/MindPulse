-- Lets a signed-in user delete their own MFA factors without an aal2 session.
--
-- Supabase refuses to enroll a replacement authenticator at aal1 while a
-- verified factor still exists ("AAL2 required to enroll a new factor") and
-- refuses to unenroll that factor at aal1 too. That leaves a user who lost
-- their authenticator unable to scan a new QR code from the browser.
--
-- The web client calls this through supabase.rpc('reset_own_mfa_factors')
-- before retrying enrollment. It only ever touches the caller's own factors.

create or replace function public.reset_own_mfa_factors()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  removed integer := 0;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  -- Clear pending challenges first in case the foreign key is not cascading.
  delete from auth.mfa_challenges
   where factor_id in (select id from auth.mfa_factors where user_id = uid);

  delete from auth.mfa_factors where user_id = uid;
  get diagnostics removed = row_count;

  return removed;
end;
$$;

revoke all on function public.reset_own_mfa_factors() from public;
grant execute on function public.reset_own_mfa_factors() to authenticated;

comment on function public.reset_own_mfa_factors() is
  'Deletes the caller''s own MFA factors so a lost authenticator can be replaced at aal1.';

-- Make PostgREST expose the new RPC immediately.
notify pgrst, 'reload schema';
