-- 0019_survey_answers.sql
-- ---------------------------------------------------------------------------
-- Persist the raw per-question answers of an assessment.
-- Until now the patient's tool survey (ToolSurveyScreen) scored the
-- questionnaire client-side and stored only the aggregate survey_score on
-- stress_sessions — the answers themselves were discarded, so nobody could
-- review *which* items drove a student's score.
--
-- The column stores a self-contained snapshot written by the patient app:
--   {
--     "toolId":   "<uuid of assessment_tools row>",
--     "toolTitle":"PSS-10 Stress Assessment",
--     "items": [ { "id": 1, "text": "…", "reverse": false,
--                  "value": 2, "label": "Sometimes" }, ... ]
--   }
-- Storing the question text at completion time keeps old sessions readable
-- even if an administrator later edits the questionnaire.
--
-- Nullable: sessions recorded before this migration have no stored answers and
-- the doctor's UI simply hides the "View survey answers" control for them.
-- Row-level security is unchanged (policies apply to the whole row).
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.stress_sessions
  add column if not exists survey_answers jsonb;

comment on column public.stress_sessions.survey_answers is
  'Self-contained snapshot of the questionnaire answered at completion: {toolId, toolTitle, items:[{id,text,reverse,value,label}]}. Null for sessions recorded before migration 0019.';

-- Record what happened (same bookkeeping pattern as 0005/0018).
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'stress_sessions', null, null,
       '0019: stress_sessions.survey_answers added for per-question review'
where not exists (
  select 1 from public.migration_report r
  where r.problem = '0019: stress_sessions.survey_answers added for per-question review'
);
