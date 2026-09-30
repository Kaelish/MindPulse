-- ===========================================================================
-- 0010_doctor_availability.sql
-- Weekly working days + one-off blocked dates ("days off") for doctors.
--
--   available_days : weekday keys the doctor accepts bookings on
--                    ('mon' … 'sun'). Existing rows default to every day so
--                    current doctors stay fully bookable.
--   blocked_dates  : specific calendar dates the doctor has off (vacation,
--                    holiday, single day off). Patients can never book them.
--
-- The patient booking app disables any date that is either not a working day
-- or present in blocked_dates; already-booked appointments are untouched.
-- ===========================================================================

alter table public.doctor_profiles
  add column if not exists available_days text[] not null default
    array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[],
  add column if not exists blocked_dates date[] not null default '{}'::date[];

comment on column public.doctor_profiles.available_days is
  'Weekday keys (''mon'' … ''sun'') the doctor accepts new bookings on; drives which day chips patients can pick.';
comment on column public.doctor_profiles.blocked_dates is
  'Specific dates (YYYY-MM-DD) the doctor has off; patients cannot book them. Existing bookings stay on the doctor''s schedule.';

-- keep the weekday list from ever storing junk (old clients, bad writes)
alter table public.doctor_profiles
  drop constraint if exists doctor_profiles_available_days_check;

alter table public.doctor_profiles
  add constraint doctor_profiles_available_days_check
  check (available_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]);
