-- 0033_pss10_guard.sql
-- ---------------------------------------------------------------------------
-- Server-side defence in depth for the version-locked built-in PSS-10
-- (admin portal Requirement 1; pairs with the recorded decisions A-10 / C-15).
--
-- The web admin portal already renders Category and Status read-only and hides
-- the delete action for the PSS-10 template, and updateAssessmentTool() re-sends
-- the stored category/status unchanged — but a hand-crafted payload could still
-- reach public.assessment_tools. This guard makes the database reject any
-- UPDATE that changes the locked template's category or status, and any DELETE
-- of it, mirroring the client predicate isPss10Tool()
-- (mindpulse-web/src/services/assessmentTools.ts): the seeded title or the
-- Multi-Modal category, evaluated on the STORED row so a payload that rewrites
-- title/category cannot slip past it.
--
-- Additive only: no columns, types, constraints or policies on existing tables
-- are changed, and no request/response shape moves — every other template
-- (Supplementary / Brief) stays fully editable and deletable. Safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.assessment_tools_pss10_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.title = 'PSS-10 Stress Assessment' or old.category = 'Multi-Modal' then
      raise exception 'The built-in PSS-10 assessment cannot be deleted';
    end if;
    return old; -- every other template stays deletable
  end if;

  if old.title = 'PSS-10 Stress Assessment' or old.category = 'Multi-Modal' then
    if new.category is distinct from old.category
       or new.status is distinct from old.status then
      raise exception 'The built-in PSS-10 assessment has locked Category and Status fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_tools_pss10_guard on public.assessment_tools;
create trigger assessment_tools_pss10_guard
  before update or delete on public.assessment_tools
  for each row execute function public.assessment_tools_pss10_guard();

-- Record what happened (same bookkeeping pattern as 0005 / 0018).
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'assessment_tools', null, null,
       'applied 0033: PSS-10 Category/Status locked and delete blocked at the database'
where not exists (
  select 1 from public.migration_report
  where problem like 'applied 0033%'
);
