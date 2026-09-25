-- ============================================================================
-- 0002 – re-run the legacy identity scan with the correct column case
--
-- 0001 was already applied when its section 11.1 scan was found to reference
-- legacy public."USER".email with the wrong case (the legacy column is
-- "EMAIL"). PostgreSQL folds unquoted identifiers to lowercase, so the first
-- scan statement failed with 'column u.email does not exist'; the exception
-- guard recorded that in public.migration_report (by design) and skipped the
-- remaining three scans.
--
-- Applied migrations are immutable, so the stale failure row is cleared here
-- and the corrected scan from 0001 is re-run. With legacy tables empty the
-- scan inserts nothing; on a database with unmappable legacy rows it now
-- reports them instead of erroring.
-- ============================================================================

delete from public.migration_report
 where legacy_table = 'legacy-scan'
   and problem like 'legacy table scan failed%';

do $$
begin
  begin
  if to_regclass('public."USER"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'USER', u."USER_ID"::text, u."EMAIL",
           'No auth.users row with this e-mail – legacy identity cannot be mapped to an authenticated user'
    from public."USER" u
    where not exists (select 1 from auth.users au where lower(au.email) = lower(u."EMAIL"))
    on conflict do nothing;
  end if;

  if to_regclass('public."DOCTOR_PROFILES"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'DOCTOR_PROFILES', d."DOCTOR_PROFILE_ID"::text, u."EMAIL",
           'Doctor profile points at a legacy USER_ID that has no matching auth.users row'
    from public."DOCTOR_PROFILES" d
    left join public."USER" u on u."USER_ID" = d."USER_ID"
    where not exists (
      select 1 from auth.users au
      where lower(au.email) = lower(coalesce(u."EMAIL", ''))
    )
    on conflict do nothing;
  end if;

  if to_regclass('public."ASSESSMENT_SESSIONS"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'ASSESSMENT_SESSIONS', s."SESSION_ID"::text, u."EMAIL",
           'Assessment session points at a legacy USER_ID that has no matching auth.users row'
    from public."ASSESSMENT_SESSIONS" s
    left join public."USER" u on u."USER_ID" = s."USER_ID"
    where not exists (
      select 1 from auth.users au
      where lower(au.email) = lower(coalesce(u."EMAIL", ''))
    )
    on conflict do nothing;
  end if;

  if to_regclass('public."STUDENT_PROFILES"') is not null then
    insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
    select 'STUDENT_PROFILES', sp."STUDENT_PROFILE_ID"::text, u."EMAIL",
           'Student profile points at a legacy USER_ID with no USER row / no matching auth.users row'
    from public."STUDENT_PROFILES" sp
    left join public."USER" u on u."USER_ID" = sp."USER_ID"
    where u."USER_ID" is null
       or not exists (select 1 from auth.users au where lower(au.email) = lower(u."EMAIL"))
    on conflict do nothing;
  end if;

  exception when others then
    insert into public.migration_report (legacy_table, legacy_id, problem)
    values ('legacy-scan', 'scan', 'legacy table scan failed: ' || sqlerrm)
    on conflict do nothing;
    raise notice 'legacy table scan failed (recorded in migration_report): %', sqlerrm;
  end;
end;
$$;
