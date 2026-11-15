-- 0038_soft_delete_doctor_suggestions.sql
-- Replace hard DELETE on doctor_suggestions with soft delete (is_deleted).
-- Withdrawing a suggestion hides it instead of destroying the row.

alter table public.doctor_suggestions
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists doctor_suggestions_is_deleted_idx
  on public.doctor_suggestions (is_deleted, deleted_at);

-- RLS: SELECT filters out soft-deleted rows.
drop policy if exists "doctor_suggestions_select" on public.doctor_suggestions;
create policy "doctor_suggestions_select" on public.doctor_suggestions
  for select to authenticated
  using (is_deleted = false);

-- RLS: UPDATE permits soft-delete (setting is_deleted = true) and other field
-- updates on non-deleted rows. Cannot update already-deleted rows (no undelete).
drop policy if exists "doctor_suggestions_update" on public.doctor_suggestions;
create policy "doctor_suggestions_update" on public.doctor_suggestions
  for update to authenticated
  using (doctor_id = auth.uid() and is_deleted = false)
  with check (doctor_id = auth.uid());

-- No DELETE policy: hard delete is disabled.

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'doctor_suggestions', null, null,
       'applied 0038: soft delete (is_deleted/deleted_at) on doctor_suggestions; DELETE disabled, UPDATE-only archive'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'doctor_suggestions'
    and problem like 'applied 0038%'
);
