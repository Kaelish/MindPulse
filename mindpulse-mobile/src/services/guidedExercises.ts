/**
 * Guided exercise library behind the "Guided exercises" tool on the assessment
 * result screen.
 *
 * Pure structure — no copy, no React — so `selfCareTips.ts` can reference an
 * `ExerciseId` without pulling the UI in, and so a missing locale for any
 * wording is a *compile* error in `i18n/types.ts` rather than an English
 * string leaking into a translated screen. Titles, step headlines and step
 * instructions live in the dictionaries under `t.results.tools.exercises`;
 * `i18n/toolCopy.test.ts` keeps each step array here and there the same length.
 *
 * Adding an exercise here plus a tip with `action: 'exercise'` (and a member
 * on `ExerciseId` plus copy in every locale) is all it takes to ship one.
 */

export interface ExerciseStep {
  /** How long to hold this step before auto-advancing. */
  seconds: number;
}

export interface GuidedExercise {
  /** Stable id — must match the tip's `toolId`. */
  id: string;
  /** Ionicons name. */
  icon: string;
  /** Accent colour used by the header and progress. */
  color: string;
  steps: ExerciseStep[];
}

/**
 * Explicit union (rather than deriving from GUIDED_EXERCISES) so a typo'd
 * `toolId` on a tip fails to compile instead of opening an empty player.
 * Add the new id here whenever you add an exercise below.
 */
export type ExerciseId = 'grounding' | 'pmr' | 'compassion' | 'unclench';

export const GUIDED_EXERCISES: GuidedExercise[] = [
  {
    id: 'grounding',
    icon: 'eye-outline',
    color: '#00897B',
    steps: [{ seconds: 40 }, { seconds: 40 }, { seconds: 40 }, { seconds: 35 }, { seconds: 30 }],
  },
  {
    id: 'pmr',
    icon: 'body-outline',
    color: '#5C6BC0',
    steps: [
      { seconds: 15 },
      { seconds: 5 },
      { seconds: 10 },
      { seconds: 5 },
      { seconds: 10 },
      { seconds: 5 },
      { seconds: 10 },
      { seconds: 5 },
      { seconds: 10 },
      { seconds: 5 },
      { seconds: 10 },
      { seconds: 20 },
    ],
  },
  {
    id: 'compassion',
    icon: 'heart-outline',
    color: '#E08A00',
    steps: [{ seconds: 25 }, { seconds: 30 }, { seconds: 30 }, { seconds: 30 }],
  },
  {
    id: 'unclench',
    icon: 'accessibility-outline',
    color: '#7B1FA2',
    steps: [{ seconds: 12 }, { seconds: 12 }, { seconds: 18 }, { seconds: 12 }, { seconds: 20 }],
  },
];

export const exerciseById = (id: string): GuidedExercise | undefined =>
  GUIDED_EXERCISES.find((e) => e.id === id);

/** Total runtime, used for the launcher button's meta line. */
export const totalSeconds = (exercise: GuidedExercise): number =>
  exercise.steps.reduce((sum, s) => sum + s.seconds, 0);
