alter table public.video_sessions
  add column if not exists started_at timestamptz,
  add column if not exists ended_at   timestamptz;

create table if not exists public.consultation_notes (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique
                 references public.appointments (id) on delete cascade,
  doctor_id      uuid not null references auth.users (id) on delete cascade,
  patient_id     uuid not null references auth.users (id) on delete cascade,
  summary        text not null,
  observations   text not null default '',
  recommendation text not null default '',
  follow_up      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists consultation_notes_patient_idx
  on public.consultation_notes (patient_id, created_at desc);
create index if not exists consultation_notes_doctor_idx
  on public.consultation_notes (doctor_id, created_at desc);

alter table public.consultation_notes enable row level security;

drop policy if exists "consultation_notes_select" on public.consultation_notes;
create policy "consultation_notes_select" on public.consultation_notes
  for select to authenticated
  using (
    patient_id = auth.uid()
    or doctor_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "consultation_notes_insert" on public.consultation_notes;
create policy "consultation_notes_insert" on public.consultation_notes
  for insert to authenticated
  with check (doctor_id = auth.uid() and public.is_doctor());

drop policy if exists "consultation_notes_update" on public.consultation_notes;
create policy "consultation_notes_update" on public.consultation_notes
  for update to authenticated
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

drop policy if exists "consultation_notes_delete_admin" on public.consultation_notes;
create policy "consultation_notes_delete_admin" on public.consultation_notes
  for delete to authenticated using (public.is_admin());

create or replace function public.end_video_consultation(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a          public.appointments%rowtype;
  v_doctor   text;
  v_student  text;
begin
  select * into a
    from public.appointments
   where id = p_appointment_id
   for update;

  if not found then
    raise exception 'Appointment % was not found', p_appointment_id;
  end if;

  if not (public.is_admin() or auth.uid() = a.doctor_id) then
    raise exception 'Only the doctor or an administrator can end this consultation';
  end if;

  update public.video_sessions
     set status   = 'ended',
         ended_at = coalesce(ended_at, now())
   where appointment_id = p_appointment_id
     and status <> 'ended';

  if a.status = 'confirmed' then
    update public.appointments
       set status = 'completed'
     where id = p_appointment_id;
  end if;

  v_doctor  := coalesce(public.display_name(a.doctor_id),  'the doctor');
  v_student := coalesce(public.display_name(a.patient_id), 'the student');

  perform public.notify_users(
    array[a.patient_id],
    'Consultation ended',
    'Your video consultation with ' || v_doctor || ' has ended. The appointment is now complete and any summary from the doctor will appear with it.',
    'appointment'
  );

  perform public.notify_users(
    array[a.doctor_id],
    'Consultation ended',
    'Your video consultation with ' || v_student || ' has ended. Add the consultation summary when you are ready.',
    'appointment'
  );

  perform public.notify_users(
    public.admin_ids(),
    'Consultation completed',
    v_student || ' completed a video consultation with ' || v_doctor || '.',
    'appointment'
  );
end;
$$;

revoke execute on function public.end_video_consultation(uuid) from anon;
grant execute on function public.end_video_consultation(uuid) to authenticated;

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
        and tablename = 'video_sessions'
    ) then
      alter publication supabase_realtime add table public.video_sessions;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
exception
  when insufficient_privilege or duplicate_object then null;
end;
$$;

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'consultation_notes', null, null,
       'applied 0014: consultation lifecycle (video_sessions started_at/ended_at, consultation_notes + RLS, end_video_consultation RPC, realtime on video_sessions and notifications)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'consultation_notes'
);
