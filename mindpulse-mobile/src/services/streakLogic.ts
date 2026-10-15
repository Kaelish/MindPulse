/**
 * Pure MindPlant streak rules — no imports, no I/O, so the arithmetic can be
 * verified in isolation (see scripts/verify-streak.js).
 *
 * Supabase persistence and the app-facing API live in ./plantProgress.ts.
 *
 * Rules (mirrored by supabase/migrations/0020_plant_streak_freeze.sql):
 *
 *   * A streak advances only when a session lands on the calendar day after
 *     the previous one. Every missed day spends one "streak freeze".
 *   * Not enough freezes to cover the gap and the streak lapses to 0, and the
 *     plant wilts back to Bare Pot with it. Growth points are a lifetime
 *     total and are never reset.
 *   * +1 freeze every 7 consecutive days (tiers at 7 / 14 / 21), starting
 *     bank 2, hard cap 5. The tier marker resets on a lapse so the grant must
 *     be re-earned on a rebuilt streak.
 */

export const FREEZE_START = 2;
export const FREEZE_MAX = 5;
export const FREEZE_TIER_DAYS = 7;
export const FREEZE_TIER_MAX = 3; // 2 start + 3 tiers = 5 = FREEZE_MAX
export const POINTS_PER_SESSION = 10;

const STAGE_THRESHOLDS: { streak: number; stage: string }[] = [
  { streak: 25, stage: 'Full Bloom' },
  { streak: 15, stage: 'Mature Plant' },
  { streak: 10, stage: 'Young Plant' },
  { streak: 5, stage: 'Sprout' },
  { streak: 1, stage: 'Seedling' },
];

/** Stage follows the current streak — a lapsed streak wilts the plant. */
export const stageForStreak = (streak: number): string =>
  STAGE_THRESHOLDS.find((t) => streak >= t.streak)?.stage ?? 'Bare Pot';

/**
 * The device's local calendar day. Deliberately not `toISOString()` — that is
 * UTC, so a 9 PM check-in in UTC+8 would already count as tomorrow. Same rule
 * as todayKey() in StressAssessmentHubScreen.
 */
export const dayKey = (d: Date = new Date()): string => {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number => {
  const parse = (key: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || '');
    if (!m) return null;
    // UTC maths on the date parts only — immune to the local timezone.
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return 0;
  return Math.round((b - a) / 86_400_000);
};

export type StreakState = {
  streak: number;
  freezes: number;
  freezeTier: number;
};

/**
 * Cover the gap between the last session and `today` with freezes.
 *
 *   gap 0 (same day)      -> nothing to cover
 *   gap 1 (consecutive)   -> nothing missed
 *   gap > 1               -> missed gap-1 days, one freeze each
 *                            - all covered -> streak kept, freezes spent
 *                            - shortfall    -> streak + tier lapse to 0
 *
 * On a lapse the freezes spent on uncovered days are gone too: a freeze
 * protects days one at a time, it does not buy the whole gap.
 *
 * Reads are side-effect free — the lapse is only persisted by the next
 * recorded session, so opening the app can never mutate stored state.
 */
export const applyGap = (
  state: StreakState,
  lastSessionDate: string | null,
  today: string,
): StreakState => {
  const { streak, freezes, freezeTier } = state;
  if (!lastSessionDate) return { streak, freezes, freezeTier };

  const gap = daysBetween(lastSessionDate, today);
  // A future-dated row (clock skew) counts as "already recorded", not a gap.
  if (gap <= 1) return { streak, freezes, freezeTier };

  const missed = gap - 1;
  const covered = Math.min(missed, freezes);
  const remaining = missed - covered;
  const afterFreezes = Math.max(0, freezes - covered);

  if (remaining > 0) {
    return { streak: 0, freezes: afterFreezes, freezeTier: 0 };
  }
  return { streak, freezes: afterFreezes, freezeTier };
};

/**
 * Next stored state after a session on `today`.
 *
 * `alreadyRecordedToday` keeps the day idempotent (no double streak step, no
 * double points) — matching the behaviour the app has always had.
 */
export const nextSessionState = (
  current: StreakState,
  lastSessionDate: string | null,
  points: number,
  today: string,
  alreadyRecordedToday: boolean,
): StreakState & { points: number } => {
  const covered = applyGap(current, lastSessionDate, today);

  if (alreadyRecordedToday) {
    return { ...covered, points };
  }

  const streak = covered.streak + 1;
  const nextPoints = points + POINTS_PER_SESSION;

  // Weekly grant on the streak that was just recorded.
  const targetTier = Math.min(FREEZE_TIER_MAX, Math.floor(streak / FREEZE_TIER_DAYS));
  const earnsTier = targetTier > covered.freezeTier;

  return {
    streak,
    freezes: earnsTier
      ? Math.min(FREEZE_MAX, covered.freezes + (targetTier - covered.freezeTier))
      : covered.freezes,
    freezeTier: earnsTier ? targetTier : covered.freezeTier,
    points: nextPoints,
  };
};
