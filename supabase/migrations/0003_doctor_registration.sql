-- ============================================================================
-- 0003 – doctor self-registration with single-administrator approval
--
-- Flow implemented here (web registration):
--   1. A psychologist/doctor fills the web registration form. signUp carries
--      their professional details in raw_user_meta_data; handle_new_user
--      creates the profile with role = 'doctor' plus a doctor_profiles row
--      that is ALWAYS created unverified (is_verified = false).
--   2. The single seeded administrator reviews the registration in the admin
--      console:  approve_doctor() verifies the doctor and confirms their
--      e-mail so they can sign in; delete_app_user() denies it, which removes
--      the account entirely.
--   3. Until approved, the web client reads is_verified and refuses to enter
--      the doctor portal (login gate in session.ts / App.tsx).
--
-- Also enforced here:
--   * Exactly one administrator account exists. The sole admin is seeded
--     below; profiles.role can never be promoted to 'admin' by an
--     authenticated client and the admin row cannot be demoted.
--   * is_verified on doctor_profiles can only be changed by an
--     administrator (trigger), so a doctor can never self-verify.
--   * Unverified doctors are hidden from other users' doctor directory
--     reads (students booking appointments only ever see approved doctors).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Signup: role comes from metadata, but only 'doctor' is ever honoured.
--    'admin' in metadata is ignored (becomes student); the administrator is
--    seeded at the bottom of this file. Professional details from the
--    registration form land in doctor_profiles, unverified.
-- ---------------------------------------------------------------------------
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
  v_role       text;
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

  v_role := case when meta_role = 'doctor' then 'doctor' else 'student' end;

  insert into public.profiles (id, first_name, last_name, full_name, email, role)
  values (new.id, nullif(meta_first, ''), nullif(meta_last, ''), nullif(meta_full, ''),
          new.email, v_role)
  on conflict (id) do nothing;

  if v_role = 'doctor' then
    -- The profiles_ensure_doctor_row trigger has already created the row
    -- during the profiles insert above; this fills it with the professional
    -- details from the registration form. is_verified is never taken from
    -- client metadata – it starts false and only the admin can set it.
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
-- 2. Single-administrator rules on profiles.role (fires on role changes).
--    Backfills/migrations (auth.uid() is null) and the service role still
--    pass through unchanged; authenticated clients can never mint or demote
--    an administrator.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_protect_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Backfills / migrations run outside an authenticated request.
  if auth.uid() is null then
    return new;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  -- Exactly one administrator account exists (seeded by this migration).
  if new.role = 'admin' and coalesce(old.role, '') <> 'admin' then
    raise exception 'Only one administrator account exists; additional admin accounts cannot be created';
  end if;
  if old.role = 'admin' and new.role <> 'admin' then
    raise exception 'The administrator account cannot be demoted';
  end if;

  if public.is_admin() then
    return new;
  end if;
  raise exception 'Account role cannot be changed by this user';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. is_verified on doctor_profiles is administrator-only.
--    INSERT: a self-registration can never arrive verified.
--    UPDATE: only the admin (or a migration / backend with no user context)
--            may change it; doctors may still edit their own bio etc.
-- ---------------------------------------------------------------------------
create or replace function public.doctor_profiles_protect_verified()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_verified and not public.is_admin() then
      new.is_verified := false;
    end if;
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified then
    if auth.uid() is null then
      return new;  -- migrations and backend jobs
    end if;
    if not public.is_admin() then
      raise exception 'Only the administrator can change a doctor verification status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists doctor_profiles_protect_verified on public.doctor_profiles;
create trigger doctor_profiles_protect_verified
  before insert or update on public.doctor_profiles
  for each row execute function public.doctor_profiles_protect_verified();

-- ---------------------------------------------------------------------------
-- 4. Doctor directory: other users only see APPROVED doctors (students on
--    the booking screen must never be offered a pending registration).
--    Owners still read their own row, admins read every row.
-- ---------------------------------------------------------------------------
drop policy if exists "doctor_profiles_select" on public.doctor_profiles;
create policy "doctor_profiles_select" on public.doctor_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (is_verified and exists (
      select 1 from public.profiles p
      where p.id = doctor_profiles.user_id and p.role = 'doctor'
    ))
  );

-- ---------------------------------------------------------------------------
-- 5. One-call approval: verifies the doctor and confirms their e-mail so the
--    approved doctor can sign in immediately (the project ships with
--    "Confirm email" enabled). Admin-gated like the other provisioning
--    functions; the doctor's own is_verified trigger accepts this because
--    the caller is an administrator.
-- ---------------------------------------------------------------------------
create or replace function public.approve_doctor(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can approve registrations';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot approve your own account';
  end if;

  update public.doctor_profiles
     set is_verified = true
   where user_id = p_user_id;
  if not found then
    raise exception 'No registration was found for this account';
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = p_user_id;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

revoke all on function public.approve_doctor(uuid) from public, anon;
grant execute on function public.approve_doctor(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seed the single administrator account.
--    Same dynamic auth.users insert as create_app_user (only writes columns
--    this GoTrue schema actually has, and fails loudly if a required column
--    is unknown). The on_auth_user_created trigger first creates the profile
--    as a student; the promotion below runs with auth.uid() null, which the
--    role guard allows for migrations.
--    Password: set here for first-run setup; rotate it in Supabase Auth ->
--    Users after your first sign-in.
-- ---------------------------------------------------------------------------
do $$
declare
  v_email   text := 'altheaolivetrecta@gmail.com';
  v_pw      text := 'krisbayot123';
  v_first   text := 'Althea';
  v_last    text := 'Olivet Recta';
  v_full    text := 'Althea Olivet Recta';
  v_id      uuid;
  v_cols    text;
  v_vals    text;
  v_missing text;
begin
  if exists (
    select 1 from public.profiles
     where role = 'admin' and lower(coalesce(email, '')) = lower(v_email)
  ) then
    return;  -- already seeded
  end if;

  select id into v_id from auth.users where lower(email) = lower(v_email) limit 1;

  if v_id is null then
    v_id := gen_random_uuid();

    select string_agg(quote_ident(x.col), ', ' order by x.ord),
           string_agg(x.val, ', ' order by x.ord)
      into v_cols, v_vals
    from (values
      (1,  'instance_id',         quote_literal('00000000-0000-0000-0000-000000000000') || '::uuid'),
      (2,  'id',                  quote_literal(v_id::text) || '::uuid'),
      (3,  'aud',                 quote_literal('authenticated')),
      (4,  'role',                quote_literal('authenticated')),
      (5,  'email',               quote_literal(lower(v_email))),
      (6,  'encrypted_password',  quote_literal(crypt(v_pw, gen_salt('bf')))),
      (7,  'email_confirmed_at',  'now()'),
      (8,  'raw_app_meta_data',   quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'),
      (9,  'raw_user_meta_data',  quote_literal(jsonb_build_object(
                                     'first_name', v_first,
                                     'last_name', v_last,
                                     'full_name', v_full)::text) || '::jsonb'),
      (10, 'created_at',          'now()'),
      (11, 'updated_at',          'now()')
    ) as x(ord, col, val)
    where exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'auth' and c.table_name = 'users' and c.column_name = x.col
    );

    if v_cols is null then
      raise exception 'admin seed: no usable columns found on auth.users';
    end if;

    select string_agg(c.column_name, ', ' order by c.column_name)
      into v_missing
    from information_schema.columns c
    where c.table_schema = 'auth' and c.table_name = 'users'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_generated <> 'ALWAYS'
      and coalesce(c.identity_generation, '') <> 'ALWAYS'
      and not exists (
        select 1 from (values ('instance_id'), ('id'), ('aud'), ('role'), ('email'),
                               ('encrypted_password'), ('email_confirmed_at'),
                               ('raw_app_meta_data'), ('raw_user_meta_data'),
                               ('created_at'), ('updated_at')) as k(col)
         where k.col = c.column_name
      );
    if v_missing is not null then
      raise exception 'admin seed: auth.users has required column(s) this migration does not know how to fill: %', v_missing;
    end if;

    execute format('insert into auth.users (%s) values (%s)', v_cols, v_vals);

    -- Identity row: nice for the Auth console, but password sign-in uses
    -- auth.users.encrypted_password, so a schema surprise here must not
    -- roll back the whole seed.
    begin
      select string_agg(quote_ident(x.col), ', ' order by x.ord),
             string_agg(x.val, ', ' order by x.ord)
        into v_cols, v_vals
      from (values
        (1, 'id',              'gen_random_uuid()'),
        (2, 'user_id',         quote_literal(v_id::text) || '::uuid'),
        (3, 'provider',        quote_literal('email')),
        (4, 'provider_id',     quote_literal(v_id::text)),
        (5, 'identity_data',   quote_literal(format('{"sub": "%s", "email": "%s", "email_verified": true}',
                                                    v_id::text, lower(v_email))) || '::jsonb'),
        (6, 'last_sign_in_at', 'now()'),
        (7, 'created_at',      'now()'),
        (8, 'updated_at',      'now()')
      ) as x(ord, col, val)
      where exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'auth' and c.table_name = 'identities' and c.column_name = x.col
      );
      if v_cols is null then
        raise exception 'no usable columns on auth.identities';
      end if;
      execute format('insert into auth.identities (%s) values (%s)', v_cols, v_vals);
    exception when others then
      raise notice 'admin seed: identity row skipped (%)', sqlerrm;
    end;
  end if;

  -- The signup trigger has created the profile (as a student); promote it.
  insert into public.profiles (id, first_name, last_name, full_name, email, role)
  values (v_id, v_first, v_last, v_full, lower(v_email), 'admin')
  on conflict (id) do nothing;

  update public.profiles
     set role = 'admin'
   where id = v_id and role <> 'admin';

  raise notice 'Seeded administrator % (e-mail confirmed)', v_email;
end;
$$;
