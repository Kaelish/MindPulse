-- 0036_soft_delete_patient_files.sql
-- Replace hard DELETE on patient_files with soft delete (is_deleted).
-- The doctor hides a patient file instead of destroying the DB row.
-- The actual storage object is still removed from the bucket separately.

alter table public.patient_files
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists patient_files_is_deleted_idx
  on public.patient_files (is_deleted, deleted_at);

-- RLS: SELECT filters out soft-deleted rows.
drop policy if exists "patient_files_select" on public.patient_files;
create policy "patient_files_select" on public.patient_files
  for select to authenticated
  using (is_deleted = false);

-- RLS: UPDATE permits soft-delete (setting is_deleted = true) and other field
-- updates on non-deleted rows. Cannot update already-deleted rows (no undelete).
drop policy if exists "patient_files_update" on public.patient_files;
create policy "patient_files_update" on public.patient_files
  for update to authenticated
  using (is_deleted = false)
  with check (true);

-- No DELETE policy: hard delete is disabled.

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'patient_files', null, null,
       'applied 0036: soft delete (is_deleted/deleted_at) on patient_files; DELETE disabled, UPDATE-only archive'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'patient_files'
    and problem like 'applied 0036%'
);
