-- 0034_assessment_type_column.sql
-- ---------------------------------------------------------------------------
-- Adds an explicit assessment_type discriminator to stress_sessions so the
-- doctor and admin portals can reliably separate daily (multi-modal PSS-10)
-- check-ins from supplementary questionnaires without string-matching hacks.
--
-- Daily assessment  -> drives recents, patient status, current stress level.
-- Supplementary     -> still counts toward average stress level, but excluded
--                      from recents/status/current-level computations.
--
-- Additive only: no existing columns are dropped, no policies change, and the
-- column has a DEFAULT so legacy inserts keep working. Safe to re-run.
-- ---------------------------------------------------------------------------

ALTER TABLE public.stress_sessions
  ADD COLUMN IF NOT EXISTS assessment_type text
    CHECK (assessment_type IN ('daily', 'supplementary'))
    DEFAULT 'daily';

-- Backfill existing rows: daily when reaction_time_ms is present or notes
-- mention the multi-modal flow; supplementary otherwise.
UPDATE public.stress_sessions
SET assessment_type = 'supplementary'
WHERE assessment_type IS DISTINCT FROM 'supplementary'
  AND reaction_time_ms IS NULL
  AND (notes IS NULL OR notes NOT ILIKE '%multi-modal%');

-- Supporting index for the per-user + type + recency queries the portals run.
CREATE INDEX IF NOT EXISTS idx_stress_sessions_user_assessment_type_created
  ON public.stress_sessions (user_id, assessment_type, created_at DESC);

-- Bookkeeping (same pattern as prior migrations).
insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'stress_sessions', null, null,
       'applied 0034: added assessment_type column (daily/supplementary) with backfill'
where not exists (
  select 1 from public.migration_report
  where problem like 'applied 0034%'
);
