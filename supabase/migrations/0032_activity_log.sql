-- 0032_activity_log.sql
-- B-4 (module M-23, Activity Log): an oversight trail written by the database.
--
-- Same reasoning as 0008: a log a client writes is not a log. Every row is
-- appended by an AFTER trigger on the four tables the module names --
-- profiles, appointments, stress_sessions, consultation_notes -- so capture
-- needs no changes to any screen and cannot be bypassed from either app.
--
-- Lean shape decided for M-23:
--   activity_log(actor, action, entity, entity_id, created_at)
--
--   actor     auth.uid() of whoever caused the change; null when the change
--             came from the database itself (the profile row created by
--             on_auth_user_created during sign-up, for example)
--   action    created | updated | deleted
--   entity    the table the change happened on
--   entity_id primary key of the affected row -- still readable after the
--             row itself is gone, which is the point of an audit trail
--
-- actor and entity_id are plain uuids with no foreign keys: a log that loses
-- its subject when an account or a record is erased proves nothing.
--
-- Writes are best-effort, mirroring 0008: a failure to append is announced
-- with `raise notice` in the server log but never rolls back a patient's
-- booking or a doctor's note. Reads are administrators only -- the client
-- roles get no INSERT, UPDATE or DELETE grant at all, so the trigger is the
-- only writer.
--
-- Safe to re-run.

create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  created_at timestamptz not null default now()
);

comment on table public.activity_log is
  'Trigger-written audit trail (M-23): who touched which record, and when.';
comment on column public.activity_log.actor is
  'auth.uid() of the account that caused the change; null = written by the database itself.';
comment on column public.activity_log.action is
  'created, updated or deleted.';
comment on column public.activity_log.entity is
  'Table name: profiles, appointments, stress_sessions, consultation_notes.';
comment on column public.activity_log.entity_id is
  'Primary key of the affected row (no foreign key: the trail must outlive it).';

create index if not exists activity_log_created_idx
  on public.activity_log (created_at desc);
create index if not exists activity_log_entity_idx
  on public.activity_log (entity, created_at desc);

alter table public.activity_log enable row level security;

-- Only the trigger (running as the table owner) writes; administrators read.
-- anon gets nothing, authenticated gets read only.
revoke all on table public.activity_log from anon, authenticated;
grant select on table public.activity_log to authenticated;

drop policy if exists "activity_log_select_admin" on public.activity_log;
create policy "activity_log_select_admin" on public.activity_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- One trigger function for all four tables: the row's identity is read from
-- the JSON form of NEW/OLD, which works for every table that has an `id`.
-- ---------------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_actor  uuid := auth.uid();
  v_action text;
begin
  if TG_OP = 'INSERT' then
    v_id := (to_jsonb(new) ->> 'id')::uuid;
    v_action := 'created';
  elsif TG_OP = 'UPDATE' then
    v_id := (to_jsonb(new) ->> 'id')::uuid;
    v_action := 'updated';
  else
    v_id := (to_jsonb(old) ->> 'id')::uuid;
    v_action := 'deleted';
  end if;

  insert into public.activity_log (actor, action, entity, entity_id)
  values (v_actor, v_action, TG_TABLE_NAME, v_id);

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
exception when others then
  raise notice 'activity_log skipped on % (%): %', TG_TABLE_NAME, TG_OP, sqlerrm;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_activity_log on public.profiles;
create trigger profiles_activity_log
  after insert or update or delete on public.profiles
  for each row execute function public.log_activity();

drop trigger if exists appointments_activity_log on public.appointments;
create trigger appointments_activity_log
  after insert or update or delete on public.appointments
  for each row execute function public.log_activity();

drop trigger if exists stress_sessions_activity_log on public.stress_sessions;
create trigger stress_sessions_activity_log
  after insert or update or delete on public.stress_sessions
  for each row execute function public.log_activity();

drop trigger if exists consultation_notes_activity_log on public.consultation_notes;
create trigger consultation_notes_activity_log
  after insert or update or delete on public.consultation_notes
  for each row execute function public.log_activity();

-- Record what happened (same bookkeeping pattern as 0005/0008/0019).
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'activity_log', null, null,
       'applied 0032: activity_log table + best-effort audit triggers on profiles, appointments, stress_sessions, consultation_notes'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'activity_log'
    and problem like 'applied 0032%'
);
