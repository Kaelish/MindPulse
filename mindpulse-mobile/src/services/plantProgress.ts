import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import {
  FREEZE_START,
  applyGap,
  dayKey,
  nextSessionState,
  stageForStreak,
} from './streakLogic';

/**
 * MindPlant progress + streak.
 *
 * All streak/freeze arithmetic lives in ./streakLogic.ts (pure, unit-tested
 * by scripts/verify-streak.js); this module only reads and upserts the row.
 *
 * Supabase columns (see supabase/migrations/0020_plant_streak_freeze.sql):
 * CURRENT_STREAK, TOTAL_GROWTH_POINTS, LAST_SESSION_DATE, FREEZES,
 * FREEZE_TIER_EARNED, CURRENT_STAGE.
 *
 * Reads derive today's state without writing, so a lapsed streak shows as 0
 * as soon as the app opens; the reset is only persisted by the next session.
 */

/**
 * Stored/derived plant state as the screens consume it: `currentStreak` is the
 * display name (StreakState calls it `streak`, so it is mapped explicitly
 * rather than inherited — otherwise the screens' `.currentStreak` breaks).
 */
export type PlantProgress = {
  currentStage: string;
  currentStreak: number;
  totalGrowthPoints: number;
  lastSessionDate: string | null;
  /** Streak freezes left AFTER covering the gap up to today. */
  freezes: number;
  /** Highest weekly tier granted so far (0-3) — resets when the streak lapses. */
  freezeTier: number;
};

const defaultProgress: PlantProgress = {
  currentStage: 'Bare Pot',
  currentStreak: 0,
  totalGrowthPoints: 0,
  lastSessionDate: null,
  freezes: FREEZE_START,
  freezeTier: 0,
};

type PlantRow = {
  CURRENT_STAGE?: string | null;
  CURRENT_STREAK?: number | null;
  TOTAL_GROWTH_POINTS?: number | null;
  LAST_SESSION_DATE?: string | null;
  FREEZES?: number | null;
  FREEZE_TIER_EARNED?: number | null;
};

const SELECT_COLUMNS =
  'CURRENT_STAGE, CURRENT_STREAK, TOTAL_GROWTH_POINTS, LAST_SESSION_DATE, FREEZES, FREEZE_TIER_EARNED';

/** Migration 0020 not applied yet — fail loudly with the exact fix. */
const friendlyError = (message: string): Error =>
  /FREEZES|FREEZE_TIER_EARNED|column/.test(message || '')
    ? new Error(
        'MindPlant streak freeze columns are missing. Run supabase/migrations/0020_plant_streak_freeze.sql in the Supabase SQL editor.',
      )
    : new Error(message);

/** Reads the raw row and derives today's view of it. Never writes. */
const readProgress = async (): Promise<PlantProgress> => {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('MIND_PLANT_PROGRESS')
    .select(SELECT_COLUMNS)
    .eq('USER_ID', userId)
    .maybeSingle();

  if (error) throw friendlyError(error.message);
  if (!data) {
    // Legitimate new-user state: no plant row has been created yet.
    return defaultProgress;
  }

  const row = data as PlantRow;
  const lastSessionDate = row.LAST_SESSION_DATE || null;
  const covered = applyGap(
    {
      streak: row.CURRENT_STREAK ?? defaultProgress.currentStreak,
      freezes: row.FREEZES ?? FREEZE_START,
      freezeTier: row.FREEZE_TIER_EARNED ?? 0,
    },
    lastSessionDate,
    dayKey(),
  );

  return {
    currentStage: stageForStreak(covered.streak),
    currentStreak: covered.streak,
    totalGrowthPoints: row.TOTAL_GROWTH_POINTS ?? defaultProgress.totalGrowthPoints,
    lastSessionDate,
    freezes: covered.freezes,
    freezeTier: covered.freezeTier,
  };
};

export async function fetchPlantProgress(): Promise<PlantProgress> {
  return readProgress();
}

export async function recordPlantSession(): Promise<PlantProgress> {
  const userId = await requireUserId();

  const current = await readProgress();
  const today = dayKey();
  // LAST_SESSION_DATE may be stored as a date or a timestamp; compare the day only.
  const alreadyRecordedToday = (current.lastSessionDate || '').slice(0, 10) === today;

  const next = nextSessionState(
    {
      streak: current.currentStreak,
      freezes: current.freezes,
      freezeTier: current.freezeTier,
    },
    current.lastSessionDate,
    current.totalGrowthPoints,
    today,
    alreadyRecordedToday,
  );

  const nextProgress: PlantProgress = {
    currentStage: stageForStreak(next.streak),
    currentStreak: next.streak,
    totalGrowthPoints: next.points,
    lastSessionDate: today,
    freezes: next.freezes,
    freezeTier: next.freezeTier,
  };

  const { error } = await supabase
    .from('MIND_PLANT_PROGRESS')
    .upsert(
      {
        USER_ID: userId,
        CURRENT_STAGE: nextProgress.currentStage,
        CURRENT_STREAK: nextProgress.currentStreak,
        TOTAL_GROWTH_POINTS: nextProgress.totalGrowthPoints,
        LAST_SESSION_DATE: nextProgress.lastSessionDate,
        FREEZES: nextProgress.freezes,
        FREEZE_TIER_EARNED: nextProgress.freezeTier,
      },
      { onConflict: 'USER_ID' },
    );

  if (error) throw friendlyError(error.message);
  return nextProgress;
}
