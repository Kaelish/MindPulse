-- Persists the doctor's "Mark as Reviewed" state (defect A-3).
--
-- Until now the control was component-local React state: it reset on every
-- page load, differed per browser, and disappeared for colleagues — a fake
-- Update against the module spec (M-05). The marker is a clinician workflow
-- signal, never clinical data, so it ships as two nullable columns.
--
-- Column-level grants keep the clinical record immutable (deviation C-4):
-- every client role may only UPDATE reviewed_at / reviewed_by, so the new
-- doctor-side UPDATE policy below can never be used to alter a score after
-- the fact. Service-role (server-side) writes are unaffected by the grant.

alter table public.stress_sessions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

comment on column public.stress_sessions.reviewed_at is
  'Set when a doctor marks the result as reviewed; null = not yet reviewed.';
comment on column public.stress_sessions.reviewed_by is
  'auth.uid() of the reviewer (doctor or admin).';

-- No client-side code updates anything else on this table today (verified
-- across both apps and every trigger in this migrations folder), so narrowing
-- UPDATE to the review columns breaks nothing and enforces C-4 at the database.
revoke update on table public.stress_sessions from anon, authenticated;
grant update (reviewed_at, reviewed_by) on public.stress_sessions to authenticated;

-- Doctors may flip the marker only on rows whose patient they actually share
-- an appointment with — mirroring the existing stress_sessions_select policy.
drop policy if exists "stress_sessions_update_review" on public.stress_sessions;
create policy "stress_sessions_update_review" on public.stress_sessions
  for update to authenticated
  using (
    public.current_app_role() = 'doctor'
    and public.has_appointment_with(user_id)
  )
  with check (
    public.current_app_role() = 'doctor'
    and public.has_appointment_with(user_id)
  );
