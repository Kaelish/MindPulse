-- ===========================================================================
-- 0013_profile_middle_initial.sql
--
-- The mobile registration form collects a middle initial ("M.I") and already
-- sends it in raw_user_meta_data from supabase.auth.signUp(), but nothing
-- ever persisted it on public.profiles. phone / birth_date / sex were wired
-- up by 0012 — the middle initial was the one field left behind.
--
--   * adds profiles.mi
--   * extends handle_new_user() to carry `mi` over at sign-up (works both
--     with and without e-mail confirmation, same as 0012)
--   * backfills existing students from their stored auth metadata
--
-- Idempotent: add column if not exists + create or replace function.
-- ===========================================================================

alter table public.profiles
  add column if not exists mi text;

comment on column public.profiles.mi is
  'Middle initial given at registration (students).';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first   text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  meta_last    text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  meta_full    text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  meta_role    text := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));
  meta_spec    text := coalesce(new.raw_user_meta_data ->> 'specialization', '');
  meta_contact text := coalesce(new.raw_user_meta_data ->> 'contact_number', '');
  meta_license text := coalesce(new.raw_user_meta_data ->> 'license_no', '');
  meta_bio     text := coalesce(new.raw_user_meta_data ->> 'bio', '');
  meta_phone   text := coalesce(new.raw_user_meta_data ->> 'phone', '');
  meta_sex     text := coalesce(new.raw_user_meta_data ->> 'sex', '');
  meta_birth   text := coalesce(new.raw_user_meta_data ->> 'birth_date', '');
  meta_mi      text := coalesce(new.raw_user_meta_data ->> 'mi', '');
  v_role       text;
  v_birth      date;
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
                               phone, sex, birth_date, mi)
  values (new.id, nullif(meta_first, ''), nullif(meta_last, ''), nullif(meta_full, ''),
          new.email, v_role,
          nullif(btrim(meta_phone), ''),
          nullif(btrim(meta_sex), ''),
          v_birth,
          nullif(btrim(meta_mi), ''))
  on conflict (id) do nothing;

  if v_role = 'doctor' then
    -- The profiles_ensure_doctor_row trigger has already created the row
    -- during the profiles insert above; this fills it with the professional
    -- details from the registration form. is_verified is never taken from
    -- client metadata - it starts false and only the admin can set it.
    insert into public.doctor_profiles (user_id, specialization, contact_number, license_no, bio)
    values (new.id, nullif(meta_spec, ''), nullif(meta_contact, ''),
            nullif(meta_license, ''), nullif(meta_bio, ''))
    on conflict (user_id) do update
      set specialization = coalesce(excluded.specialization, public.doctor_profiles.specialization),
          contact_number  = coalesce(excluded.contact_number, public.doctor_profiles.contact_number),
          license_no      = coalesce(excluded.license_no, public.doctor_profiles.license_no),
          bio             = coalesce(excluded.bio, public.doctor_profiles.bio);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: profiles created before this migration never got their M.I.
-- ---------------------------------------------------------------------------
update public.profiles p
set mi = nullif(btrim(u.raw_user_meta_data ->> 'mi'), '')
from auth.users u
where u.id = p.id
  and nullif(btrim(coalesce(u.raw_user_meta_data ->> 'mi', '')), '') is not null
  and nullif(btrim(coalesce(p.mi, '')), '') is null;

-- ---------------------------------------------------------------------------
-- Marker (same convention as 0005-0008 / 0012), so the change is visible in
-- the admin-facing migration_report table.
-- ---------------------------------------------------------------------------
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'profiles', null, null,
       'applied 0013: profiles.mi column + middle initial copied from signUp metadata by handle_new_user()'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'profiles'
    and problem like 'applied 0013%'
);
