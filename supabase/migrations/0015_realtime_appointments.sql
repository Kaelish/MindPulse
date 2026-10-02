do $$
begin
  if exists (
    select 1 from pg_publication p where p.pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'appointments'
    ) then
      alter publication supabase_realtime add table public.appointments;
    end if;
  end if;
exception
  when insufficient_privilege or duplicate_object then null;
end;
$$;

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'realtime_appointments', null, null,
       'applied 0015: realtime on appointments so consultation status changes reach the app'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'realtime_appointments'
);
