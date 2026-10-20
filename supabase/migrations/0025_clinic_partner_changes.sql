-- 0025_clinic_partner_changes.sql
-- Partner-clinic feedback, three changes:
--
-- 1. THE WHOLE THERAPY PROGRESS NOTE IS DOCTOR-ONLY.
--    Patients lose SELECT on public.consultation_notes outright. Nothing on
--    the note (presenting problem, session content, interventions, client
--    response, observations, MSE, risk, clinical impressions, plan, return to
--    clinic, the scanned handwritten note) is reachable from the patient end,
--    not even by calling PostgREST directly.
--
-- 2. A NEW "NOTE FOR THE PATIENT" replaces the old share-the-note switch.
--    The doctor writes a short general note (patient_note) and explicitly
--    publishes it (patient_note_published). That single field is the ONLY
--    thing a patient can ever read, and only once it is published, through
--    the get_patient_consultation_note() RPC.
--
-- 3. BOOKINGS CAN BE FACE-TO-FACE.
--    appointments.consultation_mode records how the session happens:
--    'online' (video call, the default) or 'in_person' (face-to-face).
--
-- "Diagnostic impressions" is relabelled "Clinical impressions" in the UI
-- only; the diagnostic_impressions column is intentionally left in place so
-- no existing data or query breaks.

-- ---------------------------------------------------------------------------
-- 1. patient-facing note on the progress note
-- ---------------------------------------------------------------------------

alter table public.consultation_notes
  add column if not exists patient_note           text not null default '',
  add column if not exists patient_note_published boolean not null default false;

comment on column public.consultation_notes.patient_note is
  'Short general note the doctor writes FOR the patient. This is the only field the patient can ever read.';
comment on column public.consultation_notes.patient_note_published is
  'FALSE (default): the patient note is a draft only the doctor and admins can see. TRUE: the patient may read patient_note.';

-- Any note that was already shared under the old model becomes readable to
-- that patient through the new RPC, so nobody loses a note they were given.
update public.consultation_notes
   set patient_note_published = true
 where shared_with_patient
   and patient_note_published = false
   and patient_note <> '';

-- ---------------------------------------------------------------------------
-- 2. RLS: consultation_notes is doctor + clinic-admin only. No patient clause.
-- ---------------------------------------------------------------------------

drop policy if exists "consultation_notes_select" on public.consultation_notes;
create policy "consultation_notes_select" on public.consultation_notes
  for select to authenticated
  using (
    doctor_id = auth.uid()
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 3. the only patient read path: a narrow RPC that hands back patient_note
-- ---------------------------------------------------------------------------

create or replace function public.get_patient_consultation_note(p_appointment_id uuid)
returns table (
  appointment_id    uuid,
  doctor_id         uuid,
  patient_note      text,
  psychologist      text,
  session_date      text,
  signature         text,
  signed_at         timestamptz,
  updated_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cn.appointment_id,
    cn.doctor_id,
    cn.patient_note,
    cn.psychologist,
    cn.session_date,
    cn.signature,
    cn.signed_at,
    cn.updated_at
  from public.consultation_notes cn
  where cn.appointment_id = p_appointment_id
    and cn.patient_id = auth.uid()
    and cn.patient_note_published
    and btrim(cn.patient_note) <> '';
$$;

revoke execute on function public.get_patient_consultation_note(uuid) from public;
revoke execute on function public.get_patient_consultation_note(uuid) from anon;
grant execute on function public.get_patient_consultation_note(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. face-to-face bookings
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists consultation_mode text not null default 'online';

alter table public.appointments
  drop constraint if exists appointments_consultation_mode_check;
alter table public.appointments
  add constraint appointments_consultation_mode_check
  check (consultation_mode in ('online', 'in_person'));

comment on column public.appointments.consultation_mode is
  'How the session happens: online (video call) or in_person (face-to-face at the clinic).';

-- ---------------------------------------------------------------------------
-- 5. end_video_consultation(): wording follows the new rules — the note is
--    private, and the doctor publishes a short patient note instead of
--    sharing the progress note. "the student" fallback becomes "the patient".
-- ---------------------------------------------------------------------------

create or replace function public.end_video_consultation(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a          public.appointments%rowtype;
  v_doctor   text;
  v_patient  text;
begin
  select * into a
    from public.appointments
   where id = p_appointment_id
   for update;

  if not found then
    raise exception 'Appointment % was not found', p_appointment_id;
  end if;

  if not (public.is_admin() or coalesce(auth.uid() = a.doctor_id, false)) then
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
  v_patient := coalesce(public.display_name(a.patient_id), 'the patient');

  perform public.notify_users(
    array[a.patient_id],
    'Consultation ended',
    'Your consultation with ' || v_doctor || ' has ended. The appointment is now complete. If your doctor publishes a note for you, it will appear with this appointment.',
    'appointment'
  );

  perform public.notify_users(
    array[a.doctor_id],
    'Consultation ended',
    'Your consultation with ' || v_patient || ' has ended. Write the therapy progress note when you are ready — it stays private to you and the clinic administrators. If there is anything the patient should see, write it in the "Note for the patient" field and publish it.',
    'appointment'
  );

  perform public.notify_users(
    public.admin_ids(),
    'Consultation completed',
    v_patient || ' completed a consultation with ' || v_doctor || '.',
    'appointment'
  );
end;
$$;

revoke execute on function public.end_video_consultation(uuid) from public;
revoke execute on function public.end_video_consultation(uuid) from anon;
grant execute on function public.end_video_consultation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. migration_report marker
-- ---------------------------------------------------------------------------

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'consultation_notes', null, null,
       'applied 0025: progress note is doctor-only (patients lost SELECT), new patient_note + patient_note_published published through get_patient_consultation_note(), appointments.consultation_mode for online/face-to-face bookings'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'consultation_notes'
    and problem like 'applied 0025%'
);
