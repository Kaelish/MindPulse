-- 0022_doctor_suggestions.sql
-- "Suggestions" — a doctor → admin communication channel. Doctors send
-- suggestions (feature requests, system improvements, issues) to the clinic
-- admin; the admin replies and flips the status; the doctor sees the reply
-- and outcome in their own list. This is separate from the patient-facing
-- `recommendations` table, which is untouched.

create table if not exists public.doctor_suggestions (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references auth.users (id) on delete cascade,
  title       text not null default '',
  category    text not null default 'Feature request'
              check (category in ('Feature request', 'System improvement', 'Issue or bug', 'Other')),
  priority    text not null default 'Medium'
              check (priority in ('Low', 'Medium', 'High')),
  message     text not null default '',
  status      text not null default 'Open'
              check (status in ('Open', 'In progress', 'Resolved')),
  admin_reply text,
  handled_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists doctor_suggestions_doctor_idx
  on public.doctor_suggestions (doctor_id, created_at desc);
create index if not exists doctor_suggestions_status_idx
  on public.doctor_suggestions (status, created_at desc);

drop trigger if exists doctor_suggestions_updated_at on public.doctor_suggestions;
create trigger doctor_suggestions_updated_at
  before update on public.doctor_suggestions
  for each row execute function public.set_updated_at();

alter table public.doctor_suggestions enable row level security;

-- Doctors see and create their own suggestions; admins see and handle all.
drop policy if exists "doctor_suggestions_select" on public.doctor_suggestions;
create policy "doctor_suggestions_select" on public.doctor_suggestions
  for select to authenticated
  using (doctor_id = auth.uid() or public.is_admin());

drop policy if exists "doctor_suggestions_insert" on public.doctor_suggestions;
create policy "doctor_suggestions_insert" on public.doctor_suggestions
  for insert to authenticated
  with check (doctor_id = auth.uid() and public.is_doctor());

-- Only admins may reply or change status (doctors may withdraw via delete).
drop policy if exists "doctor_suggestions_update" on public.doctor_suggestions;
create policy "doctor_suggestions_update" on public.doctor_suggestions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "doctor_suggestions_delete" on public.doctor_suggestions;
create policy "doctor_suggestions_delete" on public.doctor_suggestions
  for delete to authenticated
  using (doctor_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Notifications: admins are pinged on new submissions, the doctor is pinged
-- when an admin replies or moves the status. SECURITY DEFINER trigger so the
-- notification insert is not constrained by the caller's RLS on notifications.
-- ---------------------------------------------------------------------------

create or replace function public.notify_doctor_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor text;
begin
  if tg_op = 'INSERT' then
    v_doctor := coalesce(public.display_name(new.doctor_id), 'A doctor');
    perform public.notify_users(
      public.admin_ids(),
      'New doctor suggestion',
      v_doctor || ' sent a suggestion: ' || coalesce(nullif(new.title, ''), 'Untitled suggestion'),
      'alert'
    );
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (new.status is distinct from old.status
          or new.admin_reply is distinct from old.admin_reply) then
    perform public.notify_users(
      array[new.doctor_id],
      'Update on your suggestion',
      case
        when coalesce(new.admin_reply, '') <> '' then
          'The admin replied to your suggestion' ||
          case when coalesce(new.title, '') <> '' then ': ' || new.title else '.' end
        else
          'Your suggestion is now marked as "' || new.status || '".'
      end,
      'appointment'
    );
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists doctor_suggestions_notify on public.doctor_suggestions;
create trigger doctor_suggestions_notify
  after insert or update on public.doctor_suggestions
  for each row execute function public.notify_doctor_suggestion();

-- realtime (best effort, mirrors 0014)
do $$
begin
  if exists (
    select 1 from pg_publication p where p.pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'doctor_suggestions'
    ) then
      alter publication supabase_realtime add table public.doctor_suggestions;
    end if;
  end if;
exception
  when insufficient_privilege or duplicate_object then null;
end;
$$;

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'doctor_suggestions', null, null,
       'applied 0022: doctor_suggestions (doctor -> admin Suggestions channel with RLS, admin reply/status, notification triggers)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'doctor_suggestions'
);
