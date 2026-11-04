-- 0031_consent_records.sql
-- B-3 (module M-04, Consent Management): an append-only proof of consent.
--
-- Until now nothing was persisted: the sign-up forms had no consent control
-- at all and the face-scan privacy sheet's "I Understand & Continue" button
-- only closed the modal. The system therefore could not answer "did this
-- person agree, to which text version, when, and through which surface?" --
-- M-04 was audited as Not implemented.
--
-- Lean shape decided for M-04:
--   consent_records(user_id, consent_type, version, granted_at, withdrawn_at, source)
--
-- Deviation C-14: proof of consent must outlive the account, so
--   * user_id carries NO foreign key to auth.users -- account erasure (C-2)
--     removes the profile, never the evidence of agreement;
--   * the client roles are granted no DELETE (and no UPDATE: see below).
--
-- withdrawn_at ships with the schema because M-04 records withdrawal as a new
-- state, never an edit of the grant. No withdrawal flow is built in Phase 3:
-- honouring a withdrawn face-scan consent means refusing future scans, which
-- is a behaviour change that needs an adviser ruling. Until then the column
-- stays null and no client role is granted UPDATE on the table.
--
-- Registration consent is written by a trigger on auth.users (below) rather
-- than by the apps: with e-mail confirmation enabled there is no session yet
-- right after signUp(), and the trigger is the only place that can tell a
-- self-registered account apart from one the admin console provisions
-- (create_app_user also inserts into auth.users).
--
-- DEPLOYMENT ORDER: apply this migration before deploying the app updates
-- that send `consent_source`. The trigger deliberately does not swallow
-- failures (a registration without its proof must not succeed), so a sign-up
-- arriving before the table exists is rejected loudly rather than recorded
-- without evidence.
--
-- Safe to re-run.

create table if not exists public.consent_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  consent_type text not null,
  version      text not null,
  granted_at   timestamptz not null default now(),
  withdrawn_at timestamptz,
  source       text not null
);

comment on table public.consent_records is
  'Proof of consent (C-14): written once per agreement, never deleted, never edited by a client.';
comment on column public.consent_records.user_id is
  'Deliberately not a foreign key: the proof outlives the account it was given for.';
comment on column public.consent_records.consent_type is
  'registration (sign-up checkbox) or face_scan (privacy sheet).';
comment on column public.consent_records.version is
  'Version of the consent text the person agreed to.';
comment on column public.consent_records.withdrawn_at is
  'Set when consent is withdrawn (new state, never an edit of the grant). Reserved: no withdrawal flow ships yet.';
comment on column public.consent_records.source is
  'Surface the consent came from: mobile_signup, web_signup, mobile_face_scan.';

create index if not exists consent_records_user_idx
  on public.consent_records (user_id, granted_at desc);
create index if not exists consent_records_type_idx
  on public.consent_records (consent_type, granted_at desc);

alter table public.consent_records enable row level security;

-- Default privileges hand every newly created table to anon and authenticated
-- with ALL privileges. C-14 takes delete back, and update stays withheld until
-- a withdrawal flow exists (see header). service_role keeps its default
-- privileges and bypasses RLS for server-side reads.
revoke all on table public.consent_records from anon, authenticated;
grant select, insert on table public.consent_records to authenticated;

-- Read: your own proof of consent (the admin register reads through this
-- same grant) and every row for an administrator. Write: only ever your own
-- row, so a student can never file consent on somebody else's behalf.
drop policy if exists "consent_records_select_own_admin" on public.consent_records;
create policy "consent_records_select_own_admin" on public.consent_records
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "consent_records_insert_self" on public.consent_records;
create policy "consent_records_insert_self" on public.consent_records
  for insert to authenticated
  with check (user_id = auth.uid());

-- No update and no delete policy: with RLS enabled and no policy for those
-- commands, every client-side attempt is denied by the database itself.

-- ---------------------------------------------------------------------------
-- Registration consent, written with the account.
-- ---------------------------------------------------------------------------
-- Fires on every auth.users insert. The consent_source flag is put into
-- signUp() metadata only by the two sign-up forms, and only once their
-- required checkbox is ticked, so:
--   * admin-created accounts (create_app_user) produce no record -- nobody
--     ever agreed to anything on their behalf;
--   * a sign-up that predates this migration produces no record either.
-- Failure is NOT swallowed: a registration without its consent proof must
-- not succeed.
create or replace function public.record_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := btrim(coalesce(new.raw_user_meta_data ->> 'consent_source', ''));
begin
  if v_source = '' then
    return new;
  end if;

  insert into public.consent_records (user_id, consent_type, version, source)
  values (new.id, 'registration', '1.0', v_source);

  return new;
end;
$$;

drop trigger if exists on_auth_user_consent on auth.users;
create trigger on_auth_user_consent
  after insert on auth.users
  for each row execute function public.record_signup_consent();

-- Record what happened (same bookkeeping pattern as 0005/0008/0019).
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'consent_records', null, null,
       'applied 0031: consent_records table (C-14 append-only, no client delete/update) + registration consent trigger'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'consent_records'
    and problem like 'applied 0031%'
);
