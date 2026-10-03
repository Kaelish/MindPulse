-- 0018_assessment_recall_24h.sql
-- ---------------------------------------------------------------------------
-- Align the assessment wording across both ends of the app.
-- The admin portal (and the mobile tool surveys) read question text from
-- public.assessment_tools.questions, whose PSS-10 seed still used the original
-- "In the last month" recall window, while the mobile daily check-in hard-codes
-- RECALL = 'In the last 24 hours' (mindpulse-mobile/src/screens/survey/
-- StressSurveyScreen.tsx). Rewrite the DB wording to the 24-hour window so the
-- admin portal and the patient app show the same question text.
-- Safe to re-run: only rows still containing the old phrase are touched, and
-- question order / ids / reverse-scored flags / custom options are preserved.
-- Run once (safely re-runnable) in the Supabase SQL Editor for project
-- whihfwcygbqpjtrpnlck, or directly over Postgres.
-- ---------------------------------------------------------------------------

update public.assessment_tools t
set questions = (
    select coalesce(
        jsonb_agg(
            case
                when item.elem ->> 'text' like '%In the last month%'
                  or item.elem ->> 'text' like '%In the past month%'
                then (item.elem - 'text') || jsonb_build_object(
                        'text',
                        replace(
                            replace(
                                item.elem ->> 'text',
                                'In the last month',
                                'In the last 24 hours'
                            ),
                            'In the past month',
                            'In the last 24 hours'
                        )
                     )
                else item.elem
            end
            order by item.ord
        ),
        '[]'::jsonb
    )
    from jsonb_array_elements(t.questions) with ordinality as item(elem, ord)
),
updated_at = now()
where jsonb_typeof(t.questions) = 'array'
  and (t.questions::text like '%last month%' or t.questions::text like '%past month%');

-- Record what happened (same bookkeeping pattern as 0005).
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'assessment_tools', null, null,
       '0018: recall window aligned to "In the last 24 hours" for id ' || t.id
from public.assessment_tools t
where t.questions::text like '%In the last 24 hours%'
  and not exists (
    select 1 from public.migration_report r
    where r.problem = '0018: recall window aligned to "In the last 24 hours" for id ' || t.id
  );
