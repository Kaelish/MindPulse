/**
 * Guided exercise library behind the "Guided exercises" tool on the assessment
 * result screen.
 *
 * Pure data — no React, no imports — so `selfCareTips.ts` can reference an
 * `ExerciseId` without pulling the UI in. Adding an exercise here plus a tip
 * with `action: 'exercise'` is all it takes to ship one.
 *
 * Content follows the wording already used by the matching tip in
 * `selfCareTips.ts` (5-4-3-2-1 grounding; PMR's 5s tense / 10s release;
 * the self-compassion script; shoulder/jaw/neck reset).
 */

export interface ExerciseStep {
  /** Short headline, e.g. "Forearms — tense". */
  label: string;
  /** One-line instruction shown under the countdown. */
  text: string;
  /** How long to hold this step before auto-advancing. */
  seconds: number;
}

export interface GuidedExercise {
  /** Stable id — must match the tip's `toolId`. */
  id: string;
  title: string;
  subtitle: string;
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
    title: '5-4-3-2-1 grounding',
    subtitle: 'Pull your mind out of a worry loop',
    icon: 'eye-outline',
    color: '#00897B',
    steps: [
      {
        label: '5 — See',
        text: 'Look around and silently name five things you can see.',
        seconds: 40,
      },
      {
        label: '4 — Feel',
        text: 'Notice four things you can feel: your feet on the floor, the chair, your clothes, the air.',
        seconds: 40,
      },
      {
        label: '3 — Hear',
        text: 'Listen for three sounds, near or far.',
        seconds: 40,
      },
      {
        label: '2 — Smell',
        text: 'Name two things you can smell — or two smells you like if nothing is around you.',
        seconds: 35,
      },
      {
        label: '1 — Taste',
        text: 'Notice one thing you can taste, or take a slow sip of water.',
        seconds: 30,
      },
    ],
  },
  {
    id: 'pmr',
    title: 'Progressive muscle relaxation',
    subtitle: 'Tense 5 seconds, release 10 — head to toe',
    icon: 'body-outline',
    color: '#5C6BC0',
    steps: [
      { label: 'Settle in', text: 'Sit or lie somewhere comfortable, feet flat, hands loose in your lap.', seconds: 15 },
      { label: 'Forearms — tense', text: 'Curl your fingers into a fist and tighten your forearms. Hold.', seconds: 5 },
      { label: 'Forearms — release', text: 'Let go completely and notice the difference for ten seconds.', seconds: 10 },
      { label: 'Shoulders — tense', text: 'Shrug your shoulders up toward your ears. Hold.', seconds: 5 },
      { label: 'Shoulders — release', text: 'Drop them and let your neck lengthen.', seconds: 10 },
      { label: 'Face — tense', text: 'Scrunch your eyes, nose and jaw shut. Hold.', seconds: 5 },
      { label: 'Face — release', text: 'Soften your jaw, unstick your teeth, let your brow smooth.', seconds: 10 },
      { label: 'Stomach — tense', text: 'Pull your belly in tight. Hold.', seconds: 5 },
      { label: 'Stomach — release', text: 'Let it go and take one slow breath.', seconds: 10 },
      { label: 'Legs — tense', text: 'Point your toes away and tighten your thighs and calves. Hold.', seconds: 5 },
      { label: 'Legs — release', text: 'Let your legs go heavy against the floor.', seconds: 10 },
      {
        label: 'Scan',
        text: 'Run from head to toe. Anything still tight: tense it once more, then drop it.',
        seconds: 20,
      },
    ],
  },
  {
    id: 'compassion',
    title: 'Self-compassion break',
    subtitle: 'Kind self-talk, said slowly',
    icon: 'heart-outline',
    color: '#E08A00',
    steps: [
      {
        label: 'Acknowledge',
        text: 'Put a hand on your chest and say: "This is a moment of struggle."',
        seconds: 25,
      },
      {
        label: 'It is shared',
        text: '"Struggling is part of being human — I am not the only one feeling this today."',
        seconds: 30,
      },
      {
        label: 'Be kind',
        text: '"May I give myself the same patience I would give a friend right now."',
        seconds: 30,
      },
      {
        label: 'Breathe',
        text: 'Stay here for three slow breaths before you move on.',
        seconds: 30,
      },
    ],
  },
  {
    id: 'unclench',
    title: 'Unclench and reset',
    subtitle: 'A quick physical reset',
    icon: 'accessibility-outline',
    color: '#7B1FA2',
    steps: [
      { label: 'Shoulders', text: 'Drop them away from your ears and let your arms hang heavy.', seconds: 12 },
      { label: 'Jaw', text: 'Separate your teeth and let your tongue fall from the roof of your mouth.', seconds: 12 },
      { label: 'Neck', text: 'Slowly roll your head once in each direction. Never force it.', seconds: 18 },
      { label: 'Hands', text: 'Open your palms, stretch your fingers wide, then let them soften.', seconds: 12 },
      { label: 'Breathe', text: 'Two slow breaths, and notice what changed.', seconds: 20 },
    ],
  },
];

export const exerciseById = (id: string): GuidedExercise | undefined =>
  GUIDED_EXERCISES.find((e) => e.id === id);

/** Total runtime, used for the launcher button's meta line. */
export const totalSeconds = (exercise: GuidedExercise): number =>
  exercise.steps.reduce((sum, s) => sum + s.seconds, 0);
