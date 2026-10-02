-- 0016_patient_files.sql
-- Patient medical files: the doctor uploads a document (prescription,
-- lab test, other note) against a student case; the patient reads them in
-- the mobile app under Profile > My Files.
--
-- Storage layout (private bucket):
--   patient-files/{patient_id}/{doctor_id}/{timestamp}_{filename}
-- The first two path segments are the file's two owners, which is exactly
-- what the storage RLS policy checks (mirrors the chat-attachments rule in
-- 0007). Clients store the storage *path* on the row and mint short-lived
-- signed URLs when rendering.

-- ---------------------------------------------------------------------------
-- 1. Private storage bucket for patient files
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-files',
  'patient-files',
  false,
  15728640,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

drop policy if exists "patient_files_participants" on storage.objects;
create policy "patient_files_participants" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'patient-files'
    and auth.uid()::text in (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'patient-files'
    and auth.uid()::text in (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

-- ---------------------------------------------------------------------------
-- 2. patient_files
-- ---------------------------------------------------------------------------

create table if not exists public.patient_files (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references auth.users (id) on delete cascade,
  doctor_id    uuid not null references auth.users (id) on delete cascade,
  category     text not null default 'other_note'
               check (category in ('prescription', 'lab_test', 'other_note')),
  title        text not null,
  file_name    text not null,
  storage_path text not null,
  content_type text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

comment on column public.patient_files.category is
  'prescription | lab_test | other_note — drives the My Files filters on the patient app.';

create index if not exists patient_files_patient_idx
  on public.patient_files (patient_id, created_at desc);
create index if not exists patient_files_doctor_idx
  on public.patient_files (doctor_id, created_at desc);

alter table public.patient_files enable row level security;

-- The patient sees their own files, the doctor sees the files they uploaded,
-- and admins see everything.
drop policy if exists "patient_files_select" on public.patient_files;
create policy "patient_files_select" on public.patient_files
  for select to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());

-- Only the owning doctor (or an admin) may file a document.
drop policy if exists "patient_files_insert" on public.patient_files;
create policy "patient_files_insert" on public.patient_files
  for insert to authenticated
  with check (doctor_id = auth.uid() or public.is_admin());

drop policy if exists "patient_files_update" on public.patient_files;
create policy "patient_files_update" on public.patient_files
  for update to authenticated
  using (doctor_id = auth.uid() or public.is_admin())
  with check (doctor_id = auth.uid() or public.is_admin());

drop policy if exists "patient_files_delete" on public.patient_files;
create policy "patient_files_delete" on public.patient_files
  for delete to authenticated
  using (doctor_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. migration_report marker
-- ---------------------------------------------------------------------------

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'patient_files', null, null,
       'applied 0016: patient_files (doctor uploads, patient reads) + patient-files storage bucket'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'patient_files'
    and problem like 'applied 0016%'
);
