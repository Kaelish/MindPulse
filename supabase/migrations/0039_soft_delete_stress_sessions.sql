-- 0039_soft_delete_stress_sessions.sql
-- Replace hard DELETE on stress_sessions with soft delete (is_deleted).
-- Deleting assessment history hides sessions instead of destroying rows.

alter table public.stress_sessions
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists stress_sessions_is_deleted_idx
  on public.stress_sessions (is_deleted, deleted_at);

-- RLS: SELECT filters out soft-deleted rows.
drop policy if exists "stress_sessions_select" on public.stress_sessions;
create policy "stress_sessions_select" on public.stress_sessions
  for select to authenticated
  using (is_deleted = false and user_id = auth.uid());

-- RLS: UPDATE permits soft-delete (setting is_deleted = true) and other field
-- updates on non-deleted rows. Cannot update already-deleted rows (no undelete).
drop policy if exists "stress_sessions_update" on public.stress_sessions;
create policy "stress_sessions_update" on public.stress_sessions
  for update to authenticated
  using (user_id = auth.uid() and is_deleted = false)
  with check (user_id = auth.uid());

-- No DELETE policy: hard delete is disabled.

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'stress_sessions', null, null,
       'applied 0039: soft delete (is_deleted/deleted_at) on stress_sessions; DELETE disabled, UPDATE-only archive'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'stress_sessions'
    and problem like 'applied 0039%'
);
