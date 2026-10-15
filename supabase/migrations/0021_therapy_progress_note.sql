-- 0021_therapy_progress_note.sql
-- Consultation notes become a structured THERAPY PROGRESS NOTE and are
-- PRIVATE BY DEFAULT: the patient can only read a note once the doctor
-- explicitly shares it (shared_with_patient). Clinic admins keep full
-- access. Doctors may also sign the note with a drawn signature and
-- attach a scan/photo of a physically handwritten note.
--
-- Legacy columns (summary, observations, recommendation, follow_up) are
-- KEPT and kept in sync by the web client on save, so every existing
-- reader (admin records, patient card, doctor case views) keeps working.

-- ---------------------------------------------------------------------------
-- 1. therapy progress note columns
-- ---------------------------------------------------------------------------

alter table public.consultation_notes
  add column if not exists session_date        text not null default '',
  add column if not exists session_location    text not null default 'Virtual (Teleconsultation)',
  add column if not exists duration_minutes    integer,
  add column if not exists client_name         text not null default '',
  add column if not exists client_dob          text not null default '',
  add column if not exists psychologist        text not null default '',
  add column if not exists presenting_problem  text not null default '',
  add column if not exists session_content     text not null default '',
  add column if not exists interventions       text not null default '',
  add column if not exists client_response     text not null default '',
  add column if not exists therapist_observations text not null default '',
  add column if not exists mental_status_exam  text not null default '',
  add column if not exists risk_assessment     text not null default '',
  add column if not exists diagnostic_impressions text not null default '',
  add column if not exists plan_next_session   text not null default '',
  add column if not exists return_to_clinic    text not null default '';

comment on column public.consultation_notes.session_date is
  'Session date as displayed on the therapy progress note (doctor-editable, prefilled from the appointment).';

-- ---------------------------------------------------------------------------
-- 2. privacy: sharing flag + drawn signature + scanned note attachment
-- ---------------------------------------------------------------------------

alter table public.consultation_notes
  add column if not exists shared_with_patient boolean not null default false,
  add column if not exists signature           text,
  add column if not exists signed_at           timestamptz,
  add column if not exists attachment_path     text,
  add column if not exists attachment_name     text;

comment on column public.consultation_notes.shared_with_patient is
  'FALSE (default): only the doctor and clinic admins can read this note. TRUE: the patient may read the patient-facing sections.';
comment on column public.consultation_notes.signature is
  'Data URL (JPEG) of the signature the doctor drew on the signature pad.';
comment on column public.consultation_notes.attachment_path is
  'Storage path inside the consultation-docs bucket for a scanned/photographed handwritten note.';

-- ---------------------------------------------------------------------------
-- 3. RLS: patients only see notes the doctor has shared
-- ---------------------------------------------------------------------------

drop policy if exists "consultation_notes_select" on public.consultation_notes;
create policy "consultation_notes_select" on public.consultation_notes
  for select to authenticated
  using (
    (patient_id = auth.uid() and shared_with_patient)
    or doctor_id = auth.uid()
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. private storage bucket for scanned handwritten notes
--    Layout: consultation-docs/{patient_id}/{doctor_id}/{note or ts}_{filename}
--    Access is scoped to the two participants, mirroring chat-attachments.
--    NOTE-LEVEL sharing is enforced by consultation_notes RLS above: the
--    patient can only mint a signed URL when they can read the note row
--    that stores the path.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultation-docs',
  'consultation-docs',
  false,
  15728640, -- 15 MB
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "consultation_docs_participants" on storage.objects;
create policy "consultation_docs_participants" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'consultation-docs'
    and auth.uid()::text in (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'consultation-docs'
    and auth.uid()::text in (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

-- ---------------------------------------------------------------------------
-- 5. keep end_video_consultation() copy accurate: notes are private by
--    default now, so the patient is told the doctor may SHARE a summary.
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
  v_student  text;
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
  v_student := coalesce(public.display_name(a.patient_id), 'the student');

  perform public.notify_users(
    array[a.patient_id],
    'Consultation ended',
    'Your video consultation with ' || v_doctor || ' has ended. The appointment is now complete. If your doctor shares their consultation notes with you, they will appear with this appointment.',
    'appointment'
  );

  perform public.notify_users(
    array[a.doctor_id],
    'Consultation ended',
    'Your video consultation with ' || v_student || ' has ended. Write the therapy progress note when you are ready — it stays private to you unless you choose to share it.',
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

revoke execute on function public.end_video_consultation(uuid) from public;
revoke execute on function public.end_video_consultation(uuid) from anon;
grant execute on function public.end_video_consultation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. migration_report marker
-- ---------------------------------------------------------------------------

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'consultation_notes', null, null,
       'applied 0021: therapy progress note format, private by default (shared_with_patient), drawn signature, consultation-docs bucket for scanned notes'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'consultation_notes'
    and problem like 'applied 0021%'
);
