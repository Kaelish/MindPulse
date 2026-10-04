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

export type StressBand = 'low' | 'moderate' | 'high' | null;

/**
 * In-app tool that performs a suggestion. Tips without an action stay plain
 * advice; tips with one become tappable rows in the app. Widen this union as
 * new tools ship — nothing else needs to change to register one.
 *
 * `breathe` / `music` / `exercise` open a self-guided player and get a button
 * in the launcher card. `clinics` / `hotline` only *navigate* to something that
 * is already on this screen, so they render as a tappable checklist row instead
 * of a button.
 */
export type SelfCareAction =
  | 'breathe'
  | 'music'
  | 'exercise'
  | 'clinics'
  | 'hotline';

export interface SelfCareTip {
  icon: string;
  title: string;
  desc: string;
  /** Render with MaterialCommunityIcons instead of Ionicons (e.g. 'lungs'). */
  material?: boolean;
  /** Which built-in tool performs this tip, if any. */
  action?: SelfCareAction;
  /** Required when `action` is 'exercise' — which exercise to open. */
  toolId?: ExerciseId;
}

/** Actions that open a self-guided player — these belong in the launcher card. */
export type ToolAction = 'breathe' | 'music' | 'exercise';

export const isToolAction = (action: SelfCareAction): action is ToolAction =>
  action === 'breathe' || action === 'music' || action === 'exercise';

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

/** Band label used in chips and headers, e.g. "Moderate stress". */
export const bandLabel = (band: StressBand): string =>
  band ? `${band.charAt(0).toUpperCase()}${band.slice(1)} stress` : 'Stress';

/* ── Low stress: maintain the habit and keep the buffer full ─────────────── */
const LOW_TIPS: SelfCareTip[] = [
  {
    icon: 'leaf-outline',
    title: 'Keep your wind-down ritual',
    desc: 'Low stress is a good moment to lock in a habit: 5 slow minutes of breathing or stretching at the same time daily makes it automatic for hard days.',
    action: 'breathe',
  },
  {
    icon: 'create-outline',
    title: 'Start a gratitude note',
    desc: 'Write down 3 things that went well today. Gratitude journaling is one of the CDC\u2019s recommended daily stress buffers.',
  },
  {
    icon: 'walk-outline',
    title: 'Take a 20\u201330 minute walk',
    desc: 'Regular light activity lifts mood and protects against stress building up \u2014 outdoors counts double.',
  },
  {
    icon: 'people-outline',
    title: 'Invest in your people',
    desc: 'Social support is a strong buffer against student stress. Message a friend, eat with someone, or just check in on someone.',
  },
  {
    icon: 'moon-outline',
    title: 'Protect your sleep',
    desc: 'Aim for 7\u20139 hours and a steady bed/wake time. Sleep debt turns small stressors into big ones.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Take a screen/news break',
    desc: 'The CDC advises regular breaks from news and social media \u2014 constant scrolling quietly raises stress.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Do something just for fun',
    desc: 'Music, art, a hobby, a sport \u2014 enjoyable activities are a recognized stress-management tool, not a luxury.',
  },
  {
    icon: 'headset-outline',
    title: 'Put on a calming track',
    desc: 'A few minutes of slow, familiar music keeps a good day from tipping over. Low stress is the easiest time to build the habit of using it.',
    action: 'music',
  },
  {
    icon: 'partly-sunny-outline',
    title: 'Spend time outdoors',
    desc: 'Time in daylight or nature lowers tension and improves focus. Even a short break outside counts.',
  },
  {
    icon: 'water-outline',
    title: 'Hydrate and ease the caffeine',
    desc: 'Dehydration and too much coffee mimic anxiety (jitters, racing heart). Water first, caffeine slow.',
  },
  {
    icon: 'alarm-outline',
    title: 'Plan small breaks into your day',
    desc: 'Short regular breaks beat one long rest. Try a 5-minute pause every hour of study.',
  },
];

/* ── Moderate stress: active, in-the-moment coping ──────────────────────── */
const MODERATE_TIPS: SelfCareTip[] = [
  {
    icon: 'lungs',
    material: true,
    title: 'Box breathing for 5 minutes',
    desc: 'Breathe in 4s, hold 4s, out 4s, hold 4s. Research shows slow, paced breathing (5+ minutes) meaningfully lowers stress and anxiety.',
    action: 'breathe',
  },
  {
    icon: 'body-outline',
    title: 'Progressive muscle relaxation',
    desc: 'Tense each muscle group for 5 seconds, then release for 10 seconds, head to toe. Releases physical tension that feeds stress.',
    action: 'exercise',
    toolId: 'pmr',
  },
  {
    icon: 'eye-outline',
    title: 'Ground yourself: 5-4-3-2-1',
    desc: 'Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste. Pulls your mind out of worry loops into the present.',
    action: 'exercise',
    toolId: 'grounding',
  },
  {
    icon: 'create-outline',
    title: 'Worry journal + one next step',
    desc: 'Write the worry down, then the smallest next action you can take. Externalizing worries plus one action is core CBT-style coping.',
  },
  {
    icon: 'walk-outline',
    title: 'Move your body 15\u201320 minutes',
    desc: 'A brisk walk is as effective as many quick relaxers for easing stress. Movement burns off stress hormones.',
  },
  {
    icon: 'call-outline',
    title: 'Talk to someone you trust',
    desc: 'Tell a friend, family member, or schoolmate what you\u2019re feeling. Social support measurably reduces student stress and anxiety.',
  },
  {
    icon: 'headset-outline',
    title: 'Listen to calming music',
    desc: 'Put on slow, familiar music or a guided meditation for 5\u201310 minutes. Music and peer support rank among the most effective student interventions.',
    action: 'music',
  },
  {
    icon: 'list-outline',
    title: 'Shrink the task',
    desc: 'Pick ONE tiny next step (open the doc, write one paragraph). Big deadlines shrink fast once started \u2014 a core CBT technique.',
  },
  {
    icon: 'happy-outline',
    title: 'Self-compassion break',
    desc: 'Say to yourself: "This is hard right now, and that\u2019s okay \u2014 everyone struggles sometimes." Kind self-talk lowers stress reactivity.',
    action: 'exercise',
    toolId: 'compassion',
  },
  {
    icon: 'color-palette-outline',
    title: 'Create something for 10 minutes',
    desc: 'Draw, doodle, play an instrument, or craft. Art-based interventions show some of the strongest stress-relief effects for students.',
  },
  {
    icon: 'cafe-outline',
    title: 'Cut caffeine and hydrate',
    desc: 'Caffeine amplifies the physical symptoms of stress. Switch this round to water or herbal tea.',
  },
  {
    icon: 'flower-outline',
    title: 'Tidy one small space',
    desc: 'Clearing a desk or a corner gives an immediate sense of control when everything feels overwhelming.',
  },
];

/* ── High stress: bridge care while reaching out to a professional ──────── */
const HIGH_TIPS: SelfCareTip[] = [
  {
    icon: 'lungs',
    material: true,
    title: 'Box breathing until you feel steadier',
    desc: 'In 4s, hold 4s, out 4s, hold 4s \u2014 for 5 minutes. Slow breathing helps calm the body while you arrange support.',
    action: 'breathe',
  },
  {
    icon: 'headset-outline',
    title: 'Put on something calming',
    desc: 'Low, familiar music settles your body while you decide who to reach out to. It is not a replacement for support \u2014 it is a bridge to it.',
    action: 'music',
  },
  {
    icon: 'people-outline',
    title: 'Reach out to someone now',
    desc: 'Tell a trusted friend, family member, or school counselor how you\u2019re feeling today \u2014 you don\u2019t have to carry it alone.',
  },
  {
    icon: 'call-outline',
    title: 'Book a session with a professional',
    desc: 'A clinician can help you make a plan. High or prolonged stress is exactly what student counseling and telehealth sessions are for.',
    action: 'clinics',
  },
  {
    icon: 'create-outline',
    title: 'Write down the next small step',
    desc: 'When everything feels urgent, write just the single next thing you need to do \u2014 delay the rest until after you\u2019ve rested.',
  },
  {
    icon: 'moon-outline',
    title: 'Prioritize rest tonight',
    desc: 'Stress shrinks your window of tolerance. A proper night of sleep is one of the highest-return actions you can take.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'In crisis? Use the free hotlines',
    desc: 'Call or text 988 (Suicide & Crisis Lifeline) or contact your campus guidance office. Help is free, confidential, and available 24/7.',
    action: 'hotline',
  },
];

/* ── Shared fundamentals (all bands) ────────────────────────────────────── */
const SHARED_TIPS: SelfCareTip[] = [
  {
    icon: 'body-outline',
    title: 'Unclench and reset your body',
    desc: 'Drop your shoulders, unclench your jaw, roll your neck. Physical calm signals safety to your brain.',
    action: 'exercise',
    toolId: 'unclench',
  },
  {
    icon: 'water-outline',
    title: 'Drink a glass of water',
    desc: 'Simple but real: dehydration worsens fatigue and mood, which makes stress feel worse.',
  },
  {
    icon: 'time-outline',
    title: 'Take a 5-minute no-screen pause',
    desc: 'Look away from all screens, stare into the distance, and breathe. Your eyes and nervous system both get a break.',
  },
  {
    icon: 'sunny-outline',
    title: 'Step outside for daylight',
    desc: 'A few minutes of daylight resets your alertness and mood better than another scroll through your feed.',
  },
  {
    icon: 'nutrition-outline',
    title: 'Eat something small',
    desc: 'Low blood sugar feels a lot like anxiety. A quick snack with protein steadies your energy.',
  },
  {
    icon: 'heart-outline',
    title: 'Do one kind thing for yourself',
    desc: 'A warm shower, a favorite song, a short nap \u2014 small self-care acts measurably reduce perceived stress.',
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
