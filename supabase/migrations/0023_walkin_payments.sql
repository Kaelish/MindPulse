-- 0023_walkin_payments.sql
-- Walk-in payments: lets the doctor manually record a payment for a patient
-- who booked (and paid) in person, so the online consultation can proceed.
--
-- Two parts:
--   1. payments.method gains 'cash' — walk-ins almost always pay cash at the
--      desk. Card/GCash/Maya stay for the patient-app payment flow.
--   2. record_walkin_payment(...) SECURITY DEFINER RPC — the payments RLS
--      insert policy only allows a PATIENT to pay for their own
--      'awaiting_payment' booking, so a doctor can never insert a payment
--      directly. This RPC gives the doctor of record a narrow, audited path:
--      verify caller is the booking's doctor (or admin), insert the payment
--      with a WALK-IN reference, and confirm the appointment — all in one
--      transaction, so the existing status guard's "payment must be recorded
--      before confirm" rule is always satisfied.

-- ---------------------------------------------------------------------------
-- 1. widen the method check constraint to include cash
-- ---------------------------------------------------------------------------

do $$
declare
  existing text;
begin
  -- The original check was declared inline, so Postgres auto-named it.
  -- Find it by definition rather than guessing the name.
  select conname into existing
    from pg_constraint
   where conrelid = 'public.payments'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%gcash%';

  if existing is not null then
    execute format('alter table public.payments drop constraint %I', existing);
  end if;
end $$;

alter table public.payments
  add constraint payments_method_check
  check (method in ('card', 'gcash', 'maya', 'cash'));

comment on column public.payments.method is
  'card | gcash | maya (patient-app flow) | cash (walk-in recorded by the doctor)';

-- ---------------------------------------------------------------------------
-- 2. record_walkin_payment RPC
-- ---------------------------------------------------------------------------

create or replace function public.record_walkin_payment(
  p_appointment_id uuid,
  p_amount        numeric,
  p_method        text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt      public.appointments%rowtype;
  v_reference text;
  v_payment   uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to record a payment';
  end if;

  -- Lock the booking so two tabs (or a patient paying at the same moment)
  -- cannot record the same walk-in payment twice.
  select * into v_appt
    from public.appointments
   where id = p_appointment_id
   for update;

  if not found then
    raise exception 'That booking was not found';
  end if;

  if not (public.is_admin() or v_appt.doctor_id = auth.uid()) then
    raise exception 'Only the doctor on this booking or an administrator can record a payment for it';
  end if;

  if v_appt.status not in ('scheduled', 'awaiting_payment') then
    raise exception 'A payment can only be recorded while a booking is awaiting payment (this one is "%")', v_appt.status;
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Enter a valid amount';
  end if;

  if p_method not in ('card', 'gcash', 'maya', 'cash') then
    raise exception 'Unknown payment method "%"', p_method;
  end if;

  -- Self-documenting reference: immediately identifiable as a manual
  -- walk-in transaction in the list, the receipt, and any CSV export.
  v_reference := 'MP-WALKIN-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));

  insert into public.payments (appointment_id, patient_id, amount, method, reference, status)
  values (v_appt.id, v_appt.patient_id, p_amount, p_method, v_reference, 'paid')
  returning id into v_payment;

  -- Confirm the booking. The appointments_status_guard trigger allows
  -- scheduled -> confirmed for the doctor, and awaiting_payment -> confirmed
  -- because the paid row above now exists (same transaction, so it is visible).
  update public.appointments
     set status = 'confirmed'
   where id = v_appt.id
     and status in ('scheduled', 'awaiting_payment');

  return v_payment;
end;
$$;

revoke execute on function public.record_walkin_payment(uuid, numeric, text) from public;
revoke execute on function public.record_walkin_payment(uuid, numeric, text) from anon;
grant execute on function public.record_walkin_payment(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. migration_report marker
-- ---------------------------------------------------------------------------

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'payments', null, null,
       'applied 0023: walk-in payments (method gains cash, record_walkin_payment RPC records the payment and confirms the booking)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'payments'
    and problem like 'applied 0023%'
);
