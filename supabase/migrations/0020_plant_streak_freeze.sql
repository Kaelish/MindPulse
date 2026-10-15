-- ============================================================================
-- 0020 – MindPlant streak: freezes + missed-day lapse
--
-- Before this migration the streak in public."MIND_PLANT_PROGRESS" could only
-- ever grow: mindpulse-mobile/src/services/plantProgress.ts only asked
-- "did I record TODAY?", never "was my last session yesterday?", so a user who
-- skipped a week still got streak + 1 on their next session.
--
-- The app now derives the real streak from LAST_SESSION_DATE:
--   * miss up to N days while holding N "streak freezes" -> streak survives,
--     the freezes are spent;
--   * miss more days than you hold -> the streak (and the plant stage) lapses
--     to 0 and the plant wilts back to Bare Pot.
--
-- FREEZE_TIER_EARNED exists so the weekly grant cannot be farmed by resetting:
--   * +1 freeze every 7 consecutive streak days (tiers at 7 / 14 / 21 days),
--   * starting bank = 2, hard cap = 5 (2 + 3 tiers),
--   * it is reset to 0 whenever the streak lapses, so the tiers must be
--     re-earned on the rebuilt streak.
--
-- Safe to re-run: add column if not exists + DO block guarded checks.
-- ============================================================================

alter table public."MIND_PLANT_PROGRESS"
  add column if not exists "FREEZES"            integer not null default 2,
  add column if not exists "FREEZE_TIER_EARNED" integer not null default 0;

comment on column public."MIND_PLANT_PROGRESS"."FREEZES" is
  'Streak freezes in the bank. Each missed day spends one freeze; 0 freezes + a missed day lapses the streak.';
comment on column public."MIND_PLANT_PROGRESS"."FREEZE_TIER_EARNED" is
  'Highest weekly freeze tier already granted: floor(streak / 7), capped at 3 (bank caps at 5).';

-- Existing rows already have a streak, so hand them the same starting bank a
-- new account gets (default 2 on add column). Guard the checks so re-running
-- never fails on data written after this migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'MIND_PLANT_PROGRESS_freezes_range'
      and conrelid = 'public."MIND_PLANT_PROGRESS"'::regclass
  ) then
    alter table public."MIND_PLANT_PROGRESS"
      add constraint MIND_PLANT_PROGRESS_freezes_range
      check ("FREEZES" >= 0 and "FREEZES" <= 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'MIND_PLANT_PROGRESS_freeze_tier_range'
      and conrelid = 'public."MIND_PLANT_PROGRESS"'::regclass
  ) then
    alter table public."MIND_PLANT_PROGRESS"
      add constraint MIND_PLANT_PROGRESS_freeze_tier_range
      check ("FREEZE_TIER_EARNED" >= 0 and "FREEZE_TIER_EARNED" <= 3);
  end if;
end $$;
