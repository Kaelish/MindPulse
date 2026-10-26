import {
  FREEZE_MAX,
  FREEZE_START,
  POINTS_PER_SESSION,
  applyGap,
  daysBetween,
  nextSessionState,
  stageForStreak,
} from './streakLogic';

/**
 * MindPlant growth rules. These are the units the dashboard, the plant screen
 * and the Supabase upsert all depend on, so they are tested without React,
 * AsyncStorage or a network connection.
 */

const state = (streak: number, freezes: number, freezeTier: number) => ({
  streak,
  freezes,
  freezeTier,
});

const day = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

describe('daysBetween', () => {
  it('counts calendar days, not time-of-day differences', () => {
    expect(daysBetween(day(2026, 10, 15), day(2026, 10, 15))).toBe(0);
    expect(daysBetween(day(2026, 10, 15), day(2026, 10, 16))).toBe(1);
    expect(daysBetween(day(2026, 10, 15), day(2026, 10, 17))).toBe(2);
  });

  it('handles month and leap-year boundaries', () => {
    expect(daysBetween(day(2026, 1, 31), day(2026, 2, 2))).toBe(2);
    expect(daysBetween(day(2028, 2, 28), day(2028, 3, 1))).toBe(2);
    expect(daysBetween(day(2026, 2, 28), day(2026, 3, 1))).toBe(1);
  });

  it('returns a negative gap for a backward date and 0 for garbage', () => {
    expect(daysBetween(day(2026, 10, 17), day(2026, 10, 15))).toBe(-2);
    expect(daysBetween('not-a-date', day(2026, 10, 15))).toBe(0);
  });
});

describe('applyGap', () => {
  it('does nothing when there is no previous session', () => {
    expect(applyGap(state(0, FREEZE_START, 0), null, day(2026, 10, 15)))
      .toEqual(state(0, FREEZE_START, 0));
  });

  it('does not spend a freeze on a consecutive day', () => {
    expect(applyGap(state(9, 2, 1), day(2026, 10, 14), day(2026, 10, 15)))
      .toEqual(state(9, 2, 1));
  });

  it('spends one freeze for each missed day it can cover', () => {
    expect(applyGap(state(9, 2, 1), day(2026, 10, 14), day(2026, 10, 16)))
      .toEqual(state(9, 1, 1));
    expect(applyGap(state(9, 2, 1), day(2026, 10, 13), day(2026, 10, 16)))
      .toEqual(state(9, 0, 1));
  });

  it('lapses the streak and the tier when the gap is not fully covered', () => {
    expect(applyGap(state(9, 1, 1), day(2026, 10, 13), day(2026, 10, 16)))
      .toEqual(state(0, 0, 0));
    expect(applyGap(state(40, 0, 3), day(2026, 9, 1), day(2026, 10, 15)))
      .toEqual(state(0, 0, 0));
  });

  it('treats a future-dated row as already recorded (clock skew)', () => {
    expect(applyGap(state(9, 2, 1), day(2026, 10, 20), day(2026, 10, 15)))
      .toEqual(state(9, 2, 1));
  });

  it('does not mutate the input state', () => {
    const current = Object.freeze(state(9, 1, 1));

    expect(applyGap(current, day(2026, 10, 13), day(2026, 10, 16)))
      .toEqual(state(0, 0, 0));
    expect(current).toEqual(state(9, 1, 1));
  });
});

describe('stageForStreak', () => {
  it.each([
    [0, 'Bare Pot'],
    [1, 'Seedling'],
    [4, 'Seedling'],
    [5, 'Sprout'],
    [10, 'Young Plant'],
    [15, 'Mature Plant'],
    [25, 'Full Bloom'],
    [99, 'Full Bloom'],
  ])('maps a %i-day streak to %s', (streak, stage) => {
    expect(stageForStreak(streak)).toBe(stage);
  });
});

describe('nextSessionState', () => {
  it('starts a new streak and awards the first points', () => {
    expect(nextSessionState(state(0, FREEZE_START, 0), null, 0, day(2026, 10, 15), false))
      .toEqual({
        streak: 1,
        freezes: FREEZE_START,
        freezeTier: 0,
        points: POINTS_PER_SESSION,
      });
  });

  it('continues a consecutive streak', () => {
    expect(nextSessionState(state(4, 2, 0), day(2026, 10, 14), 40, day(2026, 10, 15), false))
      .toEqual({ streak: 5, freezes: 2, freezeTier: 0, points: 50 });
  });

  it('is idempotent when the same day is recorded twice', () => {
    expect(nextSessionState(state(4, 2, 0), day(2026, 10, 15), 40, day(2026, 10, 15), true))
      .toEqual({ streak: 4, freezes: 2, freezeTier: 0, points: 40 });
  });

  it('keeps the streak alive by spending a freeze on a missed day', () => {
    expect(nextSessionState(state(4, 1, 0), day(2026, 10, 13), 40, day(2026, 10, 15), false))
      .toEqual({ streak: 5, freezes: 0, freezeTier: 0, points: 50 });
  });

  it('restarts at 1 after an uncovered gap and keeps lifetime points', () => {
    expect(nextSessionState(state(40, 0, 3), day(2026, 9, 1), 400, day(2026, 10, 15), false))
      .toEqual({ streak: 1, freezes: 0, freezeTier: 0, points: 410 });
  });

  it('grants one freeze at days 7, 14 and 21 but never above the cap', () => {
    expect(nextSessionState(state(6, 2, 0), day(2026, 10, 14), 60, day(2026, 10, 15), false))
      .toEqual({ streak: 7, freezes: 3, freezeTier: 1, points: 70 });
    expect(nextSessionState(state(7, 3, 1), day(2026, 10, 14), 70, day(2026, 10, 15), false))
      .toEqual({ streak: 8, freezes: 3, freezeTier: 1, points: 80 });
    expect(nextSessionState(state(13, 3, 1), day(2026, 10, 14), 130, day(2026, 10, 15), false))
      .toEqual({ streak: 14, freezes: 4, freezeTier: 2, points: 140 });
    expect(nextSessionState(state(20, 4, 2), day(2026, 10, 14), 200, day(2026, 10, 15), false))
      .toEqual({ streak: 21, freezes: 5, freezeTier: 3, points: 210 });
    expect(nextSessionState(state(27, 5, 3), day(2026, 10, 14), 270, day(2026, 10, 15), false))
      .toEqual({ streak: 28, freezes: FREEZE_MAX, freezeTier: 3, points: 280 });
  });

  it('re-earns the weekly grant after a lapse resets the tier', () => {
    expect(nextSessionState(state(6, 0, 0), day(2026, 10, 14), 60, day(2026, 10, 15), false))
      .toEqual({ streak: 7, freezes: 1, freezeTier: 1, points: 70 });
  });
});
