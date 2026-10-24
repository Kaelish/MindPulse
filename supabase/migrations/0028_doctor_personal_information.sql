-- ===========================================================================
-- 0028_doctor_personal_information.sql
--
-- The doctor portal's Personal Information card asks for the same details as
-- doctor registration: first / last / middle name, birthdate, home address,
-- title (honorific), work e-mail, contact number, gender, clinic address,
-- short bio and license number.
--
-- Most of these already had a home:
--   profiles.first_name / last_name / email / birth_date / sex / phone / mi
--   doctor_profiles.specialization / contact_number / license_no / bio
--
-- The four new columns below cover the rest:
--   profiles.middle_name       full middle name (only the initial is displayed)
--   profiles.home_address      personal/home address
--   doctor_profiles.title      honorific: "Dr.", "Prof.", ...
--   doctor_profiles.clinic_address   clinic name / location
--
-- The app degrades gracefully when this migration has not been applied yet
-- (select('*'), auth-metadata fallbacks and the legacy availability_notes
-- JSON), so running it only upgrades storage - nothing breaks either way.
--
-- Idempotent: add column if not exists + create or replace function.
-- ===========================================================================

alter table public.profiles
  add column if not exists middle_name text,
  add column if not exists home_address text;

comment on column public.profiles.middle_name is
  'Full middle name from registration; the portal displays only its initial.';
comment on column public.profiles.home_address is
  'Personal/home address of the account holder.';

alter table public.doctor_profiles
  add column if not exists title text,
  add column if not exists clinic_address text;

comment on column public.doctor_profiles.title is
  'Honorific shown before the doctor''s name (Dr., Prof., ...).';
comment on column public.doctor_profiles.clinic_address is
  'Clinic name and location shown on the doctor profile.';

-- ---------------------------------------------------------------------------
-- Registration trigger: carry the new fields over from signUp() metadata.
-- Rewrites the 0013 version of handle_new_user().
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first    text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  meta_last     text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  meta_full     text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  meta_role     text := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));
  meta_middle   text := coalesce(new.raw_user_meta_data ->> 'middle_name', '');
  meta_spec     text := coalesce(new.raw_user_meta_data ->> 'specialization', '');
  meta_contact  text := coalesce(new.raw_user_meta_data ->> 'contact_number', '');
  meta_license  text := coalesce(new.raw_user_meta_data ->> 'license_no', '');
  meta_bio      text := coalesce(new.raw_user_meta_data ->> 'bio', '');
  meta_phone    text := coalesce(new.raw_user_meta_data ->> 'phone', '');
  meta_sex      text := coalesce(new.raw_user_meta_data ->> 'sex', '');
  meta_birth    text := coalesce(new.raw_user_meta_data ->> 'birth_date', '');
  meta_mi       text := coalesce(new.raw_user_meta_data ->> 'mi', '');
  meta_home     text := coalesce(new.raw_user_meta_data ->> 'home_address', '');
  meta_title    text := coalesce(new.raw_user_meta_data ->> 'title', '');
  meta_clinic   text := coalesce(new.raw_user_meta_data ->> 'clinic_address', '');
  v_role        text;
  v_birth       date;
begin
  if meta_full = '' then
    meta_full := trim(coalesce(meta_first, '') || ' ' || coalesce(meta_last, ''));
  end if;
  if meta_first = '' and meta_full <> '' then
    meta_first := split_part(meta_full, ' ', 1);
  end if;
  if meta_last = '' and meta_full <> '' and array_length(string_to_array(meta_full, ' '), 1) > 1 then
    meta_last := substring(meta_full from '\s(\S+)$');
  end if;

  -- A full middle name implies the initial when the client only sent one of
  -- the two (the web form sends both, the mobile form sends only `mi`).
  if meta_mi = '' and btrim(meta_middle) <> '' then
    meta_mi := upper(substr(btrim(meta_middle), 1, 1));
  end if;

  -- Birth date arrives as YYYY-MM-DD from the registration form. A malformed
  -- value must never roll back the sign-up, so it is dropped instead.
  begin
    if meta_birth ~ '^\d{4}-\d{2}-\d{2}$' then
      v_birth := meta_birth::date;
    end if;
  exception when others then
    v_birth := null;
  end;

  v_role := case when meta_role = 'doctor' then 'doctor' else 'student' end;

  insert into public.profiles (id, first_name, last_name, full_name, email, role,
                               phone, sex, birth_date, mi,
                               middle_name, home_address)
  values (new.id, nullif(meta_first, ''), nullif(meta_last, ''), nullif(meta_full, ''),
          new.email, v_role,
          nullif(btrim(meta_phone), ''),
          nullif(btrim(meta_sex), ''),
          v_birth,
          nullif(btrim(meta_mi), ''),
          nullif(btrim(meta_middle), ''),
          nullif(btrim(meta_home), ''))
  on conflict (id) do nothing;

  if v_role = 'doctor' then
    -- The profiles_ensure_doctor_row trigger has already created the row
    -- during the profiles insert above; this fills it with the professional
    -- details from the registration form. is_verified is never taken from
    -- client metadata - it starts false and only the admin can set it.
    insert into public.doctor_profiles (user_id, specialization, contact_number, license_no, bio,
                                        title, clinic_address)
    values (new.id, nullif(meta_spec, ''), nullif(meta_contact, ''),
            nullif(meta_license, ''), nullif(meta_bio, ''),
            nullif(btrim(meta_title), ''), nullif(btrim(meta_clinic), ''))
    on conflict (user_id) do update
      set specialization = coalesce(excluded.specialization, public.doctor_profiles.specialization),
          contact_number  = coalesce(excluded.contact_number, public.doctor_profiles.contact_number),
          license_no      = coalesce(excluded.license_no, public.doctor_profiles.license_no),
          bio             = coalesce(excluded.bio, public.doctor_profiles.bio),
          title           = coalesce(excluded.title, public.doctor_profiles.title),
          clinic_address  = coalesce(excluded.clinic_address, public.doctor_profiles.clinic_address);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: accounts created before this migration keep their details in the
-- signUp metadata and (for doctors) the legacy availability_notes JSON.
-- availability_notes is free text, so the cast is guarded per row.
-- ---------------------------------------------------------------------------
update public.profiles p
set middle_name = nullif(btrim(coalesce(u.raw_user_meta_data ->> 'middle_name', '')), '')
from auth.users u
where u.id = p.id
  and p.middle_name is null
  and nullif(btrim(coalesce(u.raw_user_meta_data ->> 'middle_name', '')), '') is not null;

update public.profiles p
set home_address = nullif(btrim(coalesce(u.raw_user_meta_data ->> 'home_address', '')), '')
from auth.users u
where u.id = p.id
  and p.home_address is null
  and nullif(btrim(coalesce(u.raw_user_meta_data ->> 'home_address', '')), '') is not null;

update public.doctor_profiles d
set title = nullif(btrim(coalesce(u.raw_user_meta_data ->> 'title', '')), '')
from auth.users u
where u.id = d.user_id
  and d.title is null
  and nullif(btrim(coalesce(u.raw_user_meta_data ->> 'title', '')), '') is not null;

update public.doctor_profiles d
set clinic_address = nullif(btrim(coalesce(u.raw_user_meta_data ->> 'clinic_address', '')), '')
from auth.users u
where u.id = d.user_id
  and d.clinic_address is null
  and nullif(btrim(coalesce(u.raw_user_meta_data ->> 'clinic_address', '')), '') is not null;

do $$
declare
  r record;
  extras jsonb;
begin
  for r in
    select user_id, availability_notes
    from public.doctor_profiles
    where availability_notes is not null
      and btrim(availability_notes) <> ''
  loop
    begin
      extras := r.availability_notes::jsonb;
    exception when others then
      continue;
    end;
    if extras is null or jsonb_typeof(extras) <> 'object' then
      continue;
    end if;

    update public.doctor_profiles d
    set title = coalesce(d.title, nullif(btrim(coalesce(extras ->> 'title', '')), '')),
        clinic_address = coalesce(d.clinic_address, nullif(btrim(coalesce(extras ->> 'clinicAddress', '')), ''))
    where d.user_id = r.user_id;

    update public.profiles p
    set home_address = coalesce(
          p.home_address,
          nullif(btrim(coalesce(extras ->> 'homeAddress', '')), ''),
          nullif(btrim(coalesce(extras ->> 'streetAddress', '')), '')
        ),
        middle_name = coalesce(p.middle_name, nullif(btrim(coalesce(extras ->> 'middleName', '')), ''))
    where p.id = r.user_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Marker (same convention as 0005-0008 / 0012 / 0013), so the change is
-- visible in the admin-facing migration_report table.
-- ---------------------------------------------------------------------------
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'profiles', null, null,
       'applied 0028: doctor personal information columns (profiles.middle_name/home_address, doctor_profiles.title/clinic_address) + handle_new_user() registration fields'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'profiles'
    and problem like 'applied 0028%'
);
