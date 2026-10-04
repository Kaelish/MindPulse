/**
 * Configuration and timing maths for the "no-screen pause" timer.
 *
 * Duration lives here rather than in the modal so the launcher button and the
 * countdown can never disagree about how long a pause is — the tip bank says
 * "5-minute no-screen pause" in prose, which nothing can read at runtime, so
 * this is the one machine-checkable source.
 *
 * ── WHY THIS IS WALL-CLOCK AND NOT A TICK COUNTER ──────────────────────────
 * `GuidedExerciseModal` does `elapsedRef.current += TICK_MS`. That is correct
 * there: an exercise is a few minutes of a user actively watching the screen.
 * A pause is the opposite. There is no `expo-keep-awake` in this project and
 * none should be added for this — the tip is to *stop looking at the screen*,
 * so letting the OS sleep the display is a feature, not a bug.
 *
 * The consequence is that Android will suspend JS partway through the five
 * minutes. An accumulating counter would freeze at, say, 3:47 and never reach
 * zero; the user would return to a timer that hangs forever.
 *
 * So the clock stores *when the current run started* and every reading derives
 * from `now - startedAt`. The moment the app resumes and the first tick fires,
 * it computes the true elapsed time — including "all of it" — and finishes the
 * pause correctly. Suspension becomes invisible instead of fatal.
 *
 * Pause/resume works by banking the elapsed time of the finished run, so time
 * spent paused is never counted toward the five minutes.
 */

export const PAUSE_SECONDS = 300;

export const pauseMinutes = Math.round(PAUSE_SECONDS / 60);

/** Launcher meta — derived, so the button can never claim a different length. */
export const PAUSE_META = `${pauseMinutes} min countdown`;

export const PAUSE_TOTAL_MS = PAUSE_SECONDS * 1000;

/**
 * A pause session. Immutable — every transition returns a new clock so the
 * caller can never half-update it.
 */
export interface PauseClock {
  /** Milliseconds already banked by runs that have ended. */
  banked: number;
  /** Wall-clock ms at which the current run started; 0 when not running. */
  startedAt: number;
  running: boolean;
}

export const pauseClockIdle = (): PauseClock => ({ banked: 0, startedAt: 0, running: false });

/** Elapsed milliseconds of this pause as of `now`. */
export const pauseElapsed = (clock: PauseClock, now: number): number =>
  clock.banked + (clock.running ? Math.max(0, now - clock.startedAt) : 0);

export const pauseStart = (clock: PauseClock, now: number): PauseClock => ({
  banked: 0,
  startedAt: now,
  running: true,
});

export const pauseResume = (clock: PauseClock, now: number): PauseClock => ({
  banked: pauseElapsed(clock, now),
  startedAt: now,
  running: true,
});

/** Stop running, banking whatever has elapsed so resuming continues from here. */
export const pauseStop = (clock: PauseClock, now: number): PauseClock => ({
  banked: pauseElapsed(clock, now),
  startedAt: 0,
  running: false,
});

/** Milliseconds left. Clamped at zero — this is the value that ends the pause. */
export const pauseRemainMs = (clock: PauseClock, now: number): number =>
  Math.max(0, PAUSE_TOTAL_MS - pauseElapsed(clock, now));

export const pauseRemainSec = (clock: PauseClock, now: number): number =>
  Math.ceil(pauseRemainMs(clock, now) / 1000);

export const pauseIsDone = (clock: PauseClock, now: number): boolean =>
  pauseRemainMs(clock, now) <= 0;
