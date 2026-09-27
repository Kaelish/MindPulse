-- 0008_notification_events.sql
-- Event-driven notifications, written database-side so every app (web doctor
-- portal, admin portal, mobile patient/doctor apps) produces the same feed.
--
-- Why triggers: the notifications_insert RLS policy only lets you address your
-- own row, anyone's if *you* are an admin, or someone you share an appointment
-- with. A patient's booking or a doctor's approval therefore can never reach
-- an administrator's feed from client code -- the database has to do it.
--
-- Every notice is best-effort: failures are swallowed so a notification can
-- never roll back a booking, a message or a registration.

-- ---------------------------------------------------------------------------
-- 1. helpers
-- ---------------------------------------------------------------------------

-- Human label for a user id: full name -> first+last -> email -> fallback.
create or replace function public.display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(btrim(coalesce(p.full_name, '')), ''),
    nullif(btrim(concat_ws(' ', coalesce(p.first_name, ''), coalesce(p.last_name, ''))), ''),
    nullif(p.email, ''),
    'Someone'
  )
  from public.profiles p
  where p.id = p_user;
$$;

-- Every administrator account (the recipients of the operational feed).
create or replace function public.admin_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.profiles
  where role = 'admin';
$$;

-- Best-effort fan-out: writes one row per recipient, never raises.
create or replace function public.notify_users(
  p_user_ids uuid[],
  p_title    text,
  p_message  text,
  p_type     text default 'info'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_ids is null or coalesce(array_length(p_user_ids, 1), 0) = 0 then
    return;
  end if;
  if coalesce(p_title, '') = '' then
    return;
  end if;

  insert into public.notifications (user_id, title, message, type)
  select recipient, p_title, coalesce(p_message, ''), coalesce(p_type, 'info')
    from unnest(p_user_ids) as recipient
   where recipient is not null;
exception when others then
  raise notice 'notify_users skipped: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. registrations -> administrators
--    "Doctor registered, waiting for approval" / "New student registered"
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins_of_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text := public.display_name(NEW.id);
  v_email text := coalesce(NEW.email, '');
begin
  if NEW.role = 'doctor' then
    perform public.notify_users(
      public.admin_ids(),
      'Doctor registered - awaiting approval',
      v_name || case when v_email = '' then ' created a doctor account and is waiting for approval.'
                     else ' (' || v_email || ') created a doctor account and is waiting for approval.' end
                  || ' Review it in Users.',
      'appointment'
    );
  elsif NEW.role = 'student' then
    perform public.notify_users(
      public.admin_ids(),
      'New student registered',
      v_name || case when v_email = '' then ' joined MindPulse as a student.'
                     else ' (' || v_email || ') joined MindPulse as a student.' end,
      'info'
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_registration_notice on public.profiles;
create trigger profiles_registration_notice
  after insert on public.profiles
  for each row execute function public.notify_admins_of_registration();

-- ---------------------------------------------------------------------------
-- 3. booking created -> administrators
--    "Patient booked Doctor A"
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins_of_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient text := public.display_name(NEW.patient_id);
  v_doctor  text := public.display_name(NEW.doctor_id);
begin
  perform public.notify_users(
    public.admin_ids(),
    'New appointment request',
    v_patient || ' booked an appointment with ' || v_doctor || ' on ' || coalesce(NEW.scheduled_for, 'a new slot') || '.',
    'appointment'
  );
  return NEW;
end;
$$;

drop trigger if exists appointments_booking_notice on public.appointments;
create trigger appointments_booking_notice
  after insert on public.appointments
  for each row execute function public.notify_admins_of_booking();

-- ---------------------------------------------------------------------------
-- 4. booking decided / paid / completed / cancelled / rescheduled
--    administrators see the whole timeline; the *other* party is told about
--    cancellations and time changes (e.g. "Patient A cancelled the booking").
-- ---------------------------------------------------------------------------
create or replace function public.notify_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_patient  text := public.display_name(NEW.patient_id);
  v_doctor   text := public.display_name(NEW.doctor_id);
  v_when     text := coalesce(NEW.scheduled_for, '');
begin
  if NEW.status is distinct from OLD.status then
    if NEW.status = 'awaiting_payment' then
      perform public.notify_users(public.admin_ids(), 'Appointment approved',
        v_doctor || ' approved ' || v_patient || '''s appointment on ' || v_when ||
        '. The patient must pay to confirm it.', 'appointment');
    elsif NEW.status = 'declined' then
      perform public.notify_users(public.admin_ids(), 'Appointment declined',
        v_doctor || ' declined ' || v_patient || '''s appointment on ' || v_when ||
        case when coalesce(NEW.decline_reason, '') = '' then '.'
             else ': ' || NEW.decline_reason || '.' end, 'appointment');
    elsif NEW.status = 'confirmed' then
      perform public.notify_users(public.admin_ids(), 'Payment received',
        v_patient || '''s payment for the appointment with ' || v_doctor || ' was received. The booking is confirmed.', 'appointment');
    elsif NEW.status = 'completed' then
      perform public.notify_users(public.admin_ids(), 'Session completed',
        v_patient || ' and ' || v_doctor || ' completed the appointment scheduled for ' || v_when || '.', 'appointment');
    elsif NEW.status = 'cancelled' then
      perform public.notify_users(public.admin_ids(), 'Appointment cancelled',
        'The appointment between ' || v_patient || ' and ' || v_doctor || ' on ' || v_when || ' was cancelled.', 'appointment');

      -- Tell whoever did not cancel.
      if v_actor = NEW.doctor_id then
        perform public.notify_users(array[NEW.patient_id], 'Appointment cancelled',
          v_doctor || ' cancelled your appointment on ' || v_when || '.', 'appointment');
      elsif v_actor = NEW.patient_id then
        perform public.notify_users(array[NEW.doctor_id], 'Appointment cancelled by a patient',
          v_patient || ' cancelled the appointment on ' || v_when || '.', 'appointment');
      else
        perform public.notify_users(array[NEW.patient_id, NEW.doctor_id], 'Appointment cancelled',
          'Your appointment on ' || v_when || ' was cancelled.', 'appointment');
      end if;
    end if;

  elsif NEW.scheduled_for is distinct from OLD.scheduled_for then
    if v_actor = NEW.doctor_id then
      perform public.notify_users(array[NEW.patient_id], 'Appointment rescheduled',
        v_doctor || ' moved your appointment to ' || NEW.scheduled_for || '.', 'appointment');
    elsif v_actor = NEW.patient_id then
      perform public.notify_users(array[NEW.doctor_id], 'Appointment rescheduled',
        v_patient || ' moved the appointment to ' || NEW.scheduled_for || '.', 'appointment');
    else
      perform public.notify_users(array[NEW.patient_id, NEW.doctor_id], 'Appointment rescheduled',
        'The appointment was moved from ' || coalesce(OLD.scheduled_for, 'the previous time') ||
        ' to ' || NEW.scheduled_for || '.', 'appointment');
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists appointments_status_notice on public.appointments;
create trigger appointments_status_notice
  after update of status, scheduled_for, decline_reason on public.appointments
  for each row execute function public.notify_appointment_change();

-- ---------------------------------------------------------------------------
-- 5. chat messages -> the other person in the thread
--    "Patient A sent you a message" (doctor) / "Doctor B sent you a message"
-- ---------------------------------------------------------------------------
create or replace function public.notify_chat_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
  v_recipient uuid;
  v_sender    text;
  v_role      text;
  v_label     text;
  v_body      text;
begin
  if NEW.sender = 'patient' then
    v_sender_id := NEW.patient_id;
    v_recipient := NEW.clinician_id;
  else
    v_sender_id := NEW.clinician_id;
    v_recipient := NEW.patient_id;
  end if;

  select role into v_role from public.profiles where id = v_sender_id;
  v_sender := public.display_name(v_sender_id);
  v_label  := case when v_role = 'doctor' then 'Dr. ' || v_sender else v_sender end;

  v_body := left(coalesce(btrim(NEW.text), ''), 140);
  if v_body = '' then
    v_body := case when coalesce(NEW.attachment_name, '') <> ''
                   then 'Sent an attachment: ' || NEW.attachment_name
                   else 'Sent you a message.' end;
  elsif v_body !~ '[.!?]$' then
    v_body := v_body ||
              case when char_length(coalesce(NEW.text, '')) > 140 then '…' else '.' end;
  end if;

  perform public.notify_users(
    array[v_recipient],
    'New message from ' || v_label,
    v_body,
    'info'
  );
  return NEW;
end;
$$;

drop trigger if exists chat_messages_notice on public.chat_messages;
create trigger chat_messages_notice
  after insert on public.chat_messages
  for each row execute function public.notify_chat_recipient();

-- ---------------------------------------------------------------------------
-- 6. migration_report marker (same convention as 0005-0007)
-- ---------------------------------------------------------------------------
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'notifications', null, null,
       'applied 0008: notification event triggers (registrations, booking lifecycle, chat messages)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'notifications'
    and problem like 'applied 0008%'
);
