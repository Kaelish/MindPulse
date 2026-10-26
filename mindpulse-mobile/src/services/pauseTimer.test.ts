import {
  PAUSE_META,
  PAUSE_TOTAL_MS,
  pauseClockIdle,
  pauseElapsed,
  pauseIsDone,
  pauseRemainMs,
  pauseRemainSec,
  pauseResume,
  pauseStart,
  pauseStop,
} from './pauseTimer';

/**
 * The no-screen pause timer is wall-clock based because Android may suspend
 * JavaScript while the display sleeps. These tests pin that behaviour: elapsed
 * time is always derived from `now`, and paused time is never counted.
 */

describe('pause timer metadata', () => {
  it('derives the launcher label from the single duration constant', () => {
    expect(PAUSE_TOTAL_MS).toBe(300_000);
    expect(PAUSE_META).toBe('5 min countdown');
  });
});

describe('pause clock transitions', () => {
  it('starts at zero and stays there while idle', () => {
    const idle = pauseClockIdle();

    expect(pauseElapsed(idle, 10_000)).toBe(0);
    expect(pauseRemainSec(idle, 10_000)).toBe(300);
    expect(pauseIsDone(idle, 10_000)).toBe(false);
  });

  it('derives elapsed time from the wall clock, even after a long suspension', () => {
    const clock = pauseStart(pauseClockIdle(), 1_000);

    // The app was suspended for four minutes; the first tick still knows the
    // real elapsed time because it is not a tick counter.
    expect(pauseElapsed(clock, 241_000)).toBe(240_000);
    expect(pauseRemainMs(clock, 241_000)).toBe(60_000);
    expect(pauseRemainSec(clock, 241_000)).toBe(60);
  });

  it('banks elapsed time on stop and excludes paused time on resume', () => {
    const started = pauseStart(pauseClockIdle(), 1_000);
    const stopped = pauseStop(started, 61_000);
    const resumed = pauseResume(stopped, 121_000);

    expect(stopped.banked).toBe(60_000);
    expect(stopped.running).toBe(false);
    expect(pauseElapsed(stopped, 200_000)).toBe(60_000);
    expect(pauseElapsed(resumed, 141_000)).toBe(80_000);
    expect(pauseRemainMs(resumed, 141_000)).toBe(220_000);
  });

  it('clamps at zero and reports done exactly at five minutes', () => {
    const clock = pauseStart(pauseClockIdle(), 1_000);

    expect(pauseIsDone(clock, 300_999)).toBe(false);
    expect(pauseRemainSec(clock, 299_001)).toBe(2);
    expect(pauseIsDone(clock, 301_000)).toBe(true);
    expect(pauseRemainMs(clock, 900_000)).toBe(0);
    expect(pauseRemainSec(clock, 900_000)).toBe(0);
  });

  it('never counts negative time if the device clock moves backwards', () => {
    const clock = pauseStart(pauseClockIdle(), 10_000);

    expect(pauseElapsed(clock, 5_000)).toBe(0);
    expect(pauseRemainMs(clock, 5_000)).toBe(PAUSE_TOTAL_MS);
  });
});
