-- 0024_doctor_only_scans.sql
-- Scanned/photographed handwritten notes are complete clinical documents
-- (they "have it all"), so they must stay on the doctor's side even when the
-- typed note is shared with the patient.
--
-- 0021 opened the consultation-docs bucket to "the two participants" — the
-- patient included — relying on note-level sharing to gate the path. This
-- migration closes that for good:
--   * storage RLS now grants EVERY operation on consultation-docs to the
--     doctor of record only (path layout {patient_id}/{doctor_id}/...);
--   * a patient cannot mint a signed URL for a scan even if they somehow
--     learn the path — the SELECT policy simply no longer matches them;
--   * the patient app additionally stops selecting attachment_path /
--     attachment_name and never renders the scan (client-side hardening);
--   * shared notes still show the typed patient-facing sections and the
--     drawn signature — just never the scan.
-- The admin portal has no scan view; the service role bypasses RLS by
-- design if a server-side reader is ever needed.

drop policy if exists "consultation_docs_participants" on storage.objects;
drop policy if exists "consultation_docs_doctor" on storage.objects;

create policy "consultation_docs_doctor" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'consultation-docs'
    and auth.uid()::text = (storage.foldername(name))[2]
  )
  with check (
    bucket_id = 'consultation-docs'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

comment on policy "consultation_docs_doctor" on storage.objects is
  'Handwritten scans are doctor-only: the uploading doctor (second path folder) may read/write; patients have no access, even to shared notes.';

-- ---------------------------------------------------------------------------
-- migration_report marker
-- ---------------------------------------------------------------------------

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'consultation-docs', null, null,
       'applied 0024: scanned handwritten notes are doctor-only (storage policy narrowed from both participants to the doctor of record)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'consultation-docs'
    and problem like 'applied 0024%'
);
