-- 0006_telehealth_booking.sql
-- Real telehealth workflow: patient books -> doctor approves (or declines with a
-- required reason) -> patient pays the doctor's consultation fee through a mock
-- online payment -> appointment confirmed -> shared Jitsi room per appointment.
-- Doctors also publish their own consultation fee and offered time slots.

-- ---------------------------------------------------------------------------
-- 1. appointments: decision columns + extended status set
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists decline_reason text,
  add column if not exists decision_at    timestamptz;

-- The original inline CHECK cannot be altered in place; replace it wholesale.
do $$
declare cons record;
begin
  for cons in
    select conname
      from pg_constraint
     where conrelid = 'public.appointments'::regclass
       and contype = 'c'
       and conname like '%status%'
  loop
    execute format('alter table public.appointments drop constraint %I', cons.conname);
  end loop;
end $$;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('scheduled', 'awaiting_payment', 'declined',
                    'confirmed', 'completed', 'cancelled'));

comment on column public.appointments.status is
  'scheduled (awaiting doctor decision) | awaiting_payment (approved, pay to confirm) | declined (see decline_reason) | confirmed (paid) | completed | cancelled';

-- ---------------------------------------------------------------------------
-- 2. payments – mock online payment recorded against an appointment
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id     uuid not null references auth.users (id) on delete cascade,
  amount         numeric(10, 2) not null check (amount >= 0),
  method         text not null check (method in ('card', 'gcash', 'maya')),
  reference      text not null,
  status         text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at     timestamptz not null default now()
);

create index if not exists payments_appointment_idx on public.payments (appointment_id);
create index if not exists payments_patient_idx     on public.payments (patient_id, created_at desc);

alter table public.payments enable row level security;

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select to authenticated
  using (
    patient_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.doctor_id = auth.uid()
    )
  );

drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments
  for insert to authenticated
  with check (
    patient_id = auth.uid()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.patient_id = auth.uid()
        and a.status = 'awaiting_payment'
    )
  );

drop policy if exists "payments_delete_admin" on public.payments;
create policy "payments_delete_admin" on public.payments
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. doctor_profiles: consultation fee + offered time slots
-- ---------------------------------------------------------------------------

alter table public.doctor_profiles
  add column if not exists consultation_fee numeric(10, 2) not null default 500,
  add column if not exists available_slots   jsonb not null default
    '["9:00 AM", "10:30 AM", "11:45 AM", "1:30 PM", "2:15 PM", "3:30 PM", "4:45 PM", "5:30 PM"]'::jsonb;

comment on column public.doctor_profiles.consultation_fee is 'Amount the patient must pay to confirm an appointment with this doctor.';
comment on column public.doctor_profiles.available_slots is 'Time slots this doctor offers, shown in the patient booking grid.';

-- ---------------------------------------------------------------------------
-- 4. Status transition guard
--    - only the doctor/admin may approve or decline a booking
--    - declining requires a non-empty reason
--    - confirming after approval requires a recorded paid payment
--    - time edits (scheduled_for) and slot edits are intentionally unguarded
-- ---------------------------------------------------------------------------

create or replace function public.enforce_appointment_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor         uuid := auth.uid();
  actor_is_admin boolean := public.is_admin();
  actor_is_doctor boolean := (actor is not null and actor = NEW.doctor_id);
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  if NEW.status in ('declined', 'awaiting_payment') then
    if NEW.status = 'declined'
       and (NEW.decline_reason is null or btrim(NEW.decline_reason) = '') then
      raise exception 'A reason is required when declining an appointment';
    end if;
    if OLD.status <> 'scheduled' then
      raise exception 'A booking can only be decided while it is awaiting approval (it was %)', OLD.status;
    end if;
    if not (actor_is_admin or actor_is_doctor) then
      raise exception 'Only the doctor or an administrator can decide this booking';
    end if;
    NEW.decision_at := now();
    return NEW;
  end if;

  if NEW.status = 'confirmed' then
    if OLD.status = 'awaiting_payment' then
      if not exists (
        select 1 from public.payments p
        where p.appointment_id = NEW.id and p.status = 'paid'
      ) then
        raise exception 'Payment must be recorded before this appointment can be confirmed';
      end if;
    elsif OLD.status = 'scheduled' then
      if not (actor_is_admin or actor_is_doctor) then
        raise exception 'Only the doctor or an administrator can confirm this booking';
      end if;
    else
      raise exception 'An appointment cannot move from % to confirmed', OLD.status;
    end if;
    NEW.decision_at := coalesce(NEW.decision_at, now());
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists appointments_status_guard on public.appointments;
create trigger appointments_status_guard
  before update of status, decline_reason on public.appointments
  for each row execute function public.enforce_appointment_transition();

-- ---------------------------------------------------------------------------
-- 5. migration_report marker
-- ---------------------------------------------------------------------------

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'appointments', null, null,
       'applied 0006: telehealth workflow (decline_reason/decision_at, awaiting_payment+declined statuses, payments table, doctor fee+slots, status guard trigger)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'appointments'
    and problem like 'applied 0006%'
);
