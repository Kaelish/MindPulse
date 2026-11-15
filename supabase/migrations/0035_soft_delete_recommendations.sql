-- 0035_soft_delete_recommendations.sql
-- Replace hard DELETE on recommendations with soft delete (is_deleted).
-- The doctor withdraws/hides a recommendation instead of destroying it.
-- Completed entries stay withdrawable; the row is preserved for audit.

alter table public.recommendations
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists recommendations_is_deleted_idx
  on public.recommendations (is_deleted, deleted_at);

-- RLS: SELECT filters out soft-deleted rows.
drop policy if exists "recommendations_select" on public.recommendations;
create policy "recommendations_select" on public.recommendations
  for select to authenticated
  using (is_deleted = false and doctor_id = auth.uid());

-- RLS: UPDATE permits soft-delete (setting is_deleted = true) and other field
-- updates on non-deleted rows. Cannot update already-deleted rows (no undelete).
drop policy if exists "recommendations_update" on public.recommendations;
create policy "recommendations_update" on public.recommendations
  for update to authenticated
  using (doctor_id = auth.uid() and is_deleted = false)
  with check (doctor_id = auth.uid());

-- No DELETE policy: hard delete is disabled. Rows are archived, not removed.

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'recommendations', null, null,
       'applied 0035: soft delete (is_deleted/deleted_at) on recommendations; DELETE disabled, UPDATE-only archive'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'recommendations'
    and problem like 'applied 0035%'
);
