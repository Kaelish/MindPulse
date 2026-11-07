/**
 * Self-care suggestion bank for stress notifications and the Home card.
 *
 * Sources: CDC "Managing Stress" guidance, Mayo Clinic mindfulness exercises,
 * and meta-analyses of self-guided stress management for college students
 * (Amanvermez et al. 2022; Halladay et al. 2018; SAMHSA campus guides) —
 * slow breathing (>=5 min), physical activity, journaling/gratitude, social
 * support, mindfulness, and CBT-style task breakdown rank strongest.
 */

import type { ExerciseId } from './guidedExercises';
import type { JournalId } from './journal';

export type StressBand = 'low' | 'moderate' | 'high' | null;

/**
 * In-app tool that performs a suggestion. Tips without an action stay plain
 * advice; tips with one become tappable rows in the app. Widen this union as
 * new tools ship — nothing else needs to change to register one.
 *
 * `breathe` / `music` / `exercise` / `journal` / `pause` open a self-guided
 * player and get a button in the launcher card. `clinics` / `hotline` only
 * *navigate* to something that is already on this screen, so they render as a
 * tappable checklist row instead of a button.
 */
export type SelfCareAction =
  | 'breathe'
  | 'music'
  | 'exercise'
  | 'journal'
  | 'pause'
  | 'clinics'
  | 'hotline';

/**
 * Stable key for a tip's localized copy. Titles and descriptions live in the
 * i18n dictionaries (`t.selfCare.tips[id]`), never in this file, so a tip can
 * only ever render in the language the patient picked. Adding a tip means
 * adding a member here — `Translations` then fails to compile until all three
 * locales carry its copy.
 */
export type SelfCareTipId =
  | 'lowWindDown'
  | 'lowGratitude'
  | 'lowWalk'
  | 'lowPeople'
  | 'lowSleep'
  | 'lowScreenBreak'
  | 'lowFun'
  | 'lowMusic'
  | 'lowOutdoors'
  | 'lowHydrate'
  | 'lowBreaks'
  | 'modBoxBreathing'
  | 'modPmr'
  | 'modGrounding'
  | 'modWorryJournal'
  | 'modMove'
  | 'modTalk'
  | 'modMusic'
  | 'modShrinkTask'
  | 'modSelfCompassion'
  | 'modCreate'
  | 'modCaffeine'
  | 'modTidy'
  | 'highBoxBreathing'
  | 'highMusic'
  | 'highReachOut'
  | 'highBookSession'
  | 'highNextStep'
  | 'highRest'
  | 'highHotline'
  | 'sharedUnclench'
  | 'sharedWater'
  | 'sharedPause'
  | 'sharedDaylight'
  | 'sharedSnack'
  | 'sharedSelfKindness';

export interface SelfCareTip {
  icon: string;
  /** Selects this tip's copy in every locale — see `SelfCareTipId`. */
  id: SelfCareTipId;
  /** Render with MaterialCommunityIcons instead of Ionicons (e.g. 'lungs'). */
  material?: boolean;
  /** Which built-in tool performs this tip, if any. */
  action?: SelfCareAction;
  /** Required when `action` is 'exercise' — which exercise to open. */
  toolId?: ExerciseId;
  /**
   * Required when `action` is 'journal' — which prompt sheet to open. Kept
   * separate from `toolId` so each field stays a literal union of only the
   * ids that tool accepts.
   */
  journalId?: JournalId;
}

/** Actions that open a self-guided player — these belong in the launcher card. */
export type ToolAction = 'breathe' | 'music' | 'exercise' | 'journal' | 'pause';

export const isToolAction = (action: SelfCareAction): action is ToolAction =>
  action === 'breathe' ||
  action === 'music' ||
  action === 'exercise' ||
  action === 'journal' ||
  action === 'pause';

const findBand = (text: string): StressBand => {
  const t = text.toLowerCase();
  if (/\bhigh\b/.test(t)) return 'high';
  if (/\bmoderate\b/.test(t)) return 'moderate';
  if (/\blow\b/.test(t)) return 'low';
  return null;
};

/**
 * Detects the stress band of a notification: a score ("score of 72") wins
 * over band words ("Moderate Stress Check-in"). Same thresholds as
 * levelForScore in dashboard.ts (>60 high, >35 moderate).
 */
export const stressBandFor = (title: string, message: string): StressBand => {
  const scoreMatch = `${title} ${message}`.match(/\bscore(?:d)?\s+(?:of\s+)?(\d{1,3})\b/i);
  if (scoreMatch) {
    const score = Number(scoreMatch[1]);
    if (score > 60) return 'high';
    if (score > 35) return 'moderate';
    return 'low';
  }
  return findBand(title) ?? findBand(message);
};

/* ── Low stress: maintain the habit and keep the buffer full ─────────────── */
const LOW_TIPS: SelfCareTip[] = [
  {
    icon: 'leaf-outline',
    id: 'lowWindDown',
    action: 'breathe',
  },
  {
    icon: 'create-outline',
    id: 'lowGratitude',
    action: 'journal',
    journalId: 'gratitude',
  },
  {
    icon: 'walk-outline',
    id: 'lowWalk',
  },
  {
    icon: 'people-outline',
    id: 'lowPeople',
  },
  {
    icon: 'moon-outline',
    id: 'lowSleep',
  },
  {
    icon: 'phone-portrait-outline',
    id: 'lowScreenBreak',
  },
  {
    icon: 'sparkles-outline',
    id: 'lowFun',
  },
  {
    icon: 'headset-outline',
    id: 'lowMusic',
    action: 'music',
  },
  {
    icon: 'partly-sunny-outline',
    id: 'lowOutdoors',
  },
  {
    icon: 'water-outline',
    id: 'lowHydrate',
  },
  {
    icon: 'alarm-outline',
    id: 'lowBreaks',
  },
];

/* ── Moderate stress: active, in-the-moment coping ──────────────────────── */
const MODERATE_TIPS: SelfCareTip[] = [
  {
    icon: 'lungs',
    material: true,
    id: 'modBoxBreathing',
    action: 'breathe',
  },
  {
    icon: 'body-outline',
    id: 'modPmr',
    action: 'exercise',
    toolId: 'pmr',
  },
  {
    icon: 'eye-outline',
    id: 'modGrounding',
    action: 'exercise',
    toolId: 'grounding',
  },
  {
    icon: 'create-outline',
    id: 'modWorryJournal',
    action: 'journal',
    journalId: 'worry',
  },
  {
    icon: 'walk-outline',
    id: 'modMove',
  },
  {
    icon: 'call-outline',
    id: 'modTalk',
  },
  {
    icon: 'headset-outline',
    id: 'modMusic',
    action: 'music',
  },
  {
    icon: 'list-outline',
    id: 'modShrinkTask',
  },
  {
    icon: 'happy-outline',
    id: 'modSelfCompassion',
    action: 'exercise',
    toolId: 'compassion',
  },
  {
    icon: 'color-palette-outline',
    id: 'modCreate',
  },
  {
    icon: 'cafe-outline',
    id: 'modCaffeine',
  },
  {
    icon: 'flower-outline',
    id: 'modTidy',
  },
];

/* ── High stress: bridge care while reaching out to a professional ──────── */
const HIGH_TIPS: SelfCareTip[] = [
  {
    icon: 'lungs',
    material: true,
    id: 'highBoxBreathing',
    action: 'breathe',
  },
  {
    icon: 'headset-outline',
    id: 'highMusic',
    action: 'music',
  },
  {
    icon: 'people-outline',
    id: 'highReachOut',
  },
  {
    icon: 'call-outline',
    id: 'highBookSession',
    action: 'clinics',
  },
  {
    icon: 'create-outline',
    id: 'highNextStep',
    action: 'journal',
    journalId: 'nextStep',
  },
  {
    icon: 'moon-outline',
    id: 'highRest',
  },
  {
    icon: 'shield-checkmark-outline',
    id: 'highHotline',
    action: 'hotline',
  },
];

/* ── Shared fundamentals (all bands) ────────────────────────────────────── */
const SHARED_TIPS: SelfCareTip[] = [
  {
    icon: 'body-outline',
    id: 'sharedUnclench',
    action: 'exercise',
    toolId: 'unclench',
  },
  {
    icon: 'water-outline',
    id: 'sharedWater',
  },
  {
    icon: 'time-outline',
    id: 'sharedPause',
    action: 'pause',
  },
  {
    icon: 'sunny-outline',
    id: 'sharedDaylight',
  },
  {
    icon: 'nutrition-outline',
    id: 'sharedSnack',
  },
  {
    icon: 'heart-outline',
    id: 'sharedSelfKindness',
  },
];

/** Band-specific tips first, then shared fundamentals. */
export const tipsForBand = (band: StressBand): SelfCareTip[] => {
  if (band === 'high') return [...HIGH_TIPS, ...SHARED_TIPS.slice(0, 4)];
  if (band === 'moderate') return [...MODERATE_TIPS, ...SHARED_TIPS];
  if (band === 'low') return [...LOW_TIPS, ...SHARED_TIPS];
  return [...MODERATE_TIPS, ...SHARED_TIPS];
};

/**
 * The band's tips that a built-in tool can genuinely perform — returned with
 * `action` narrowed so callers get a discriminated union instead of a cast.
 */
export const actionableTipsFor = (
  band: StressBand,
): (SelfCareTip & { action: SelfCareAction })[] =>
  tipsForBand(band).filter(
    (tip): tip is SelfCareTip & { action: SelfCareAction } => !!tip.action,
  );

/** Deterministic 3-tip preview for the Home card (varies by latest score). */
export const previewTipsFor = (band: StressBand, seed: number): SelfCareTip[] => {
  const tips = tipsForBand(band);
  const start = Math.abs(seed) % Math.max(1, tips.length - 3);
  return tips.slice(start, start + 3);
};
