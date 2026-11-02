/**
 * Canonical multi-modal stress formula (fix A-6).
 *
 * Before this module the fusion lived in three places with three different
 * definitions — the assessment hub (which writes the session's `score`), the
 * standalone reaction-flow result screen (`|bpm-70|×1.5` HR, 40/60 blend), and
 * the web portal's component bars (`(hr-55)/45`, a legacy FER emotion map) — so
 * the same student could see three different numbers for one measurement.
 *
 * The hub's fusion is the source of truth, because it is what gets PERSISTED
 * (`AssessmentResultScreen` saves the fused value into `stress_sessions.score`,
 * which every dashboard, report and alert threshold then uses). Nothing here
 * changes that stored value — this module only moves the definition into one
 * importable place, and the other two sites now call it.
 *
 * All four indicators map to a 0–100 stress scale (higher = more stress):
 *   - survey: the PSS-10 score is already 0–100.
 *   - heart rate: 60 bpm baseline, +2 stress per bpm, clamped.
 *   - face: happy 20, neutral 50, sad 80 — confidence pulls the value toward
 *     neutral so an unsure scan barely moves the score. Legacy FER labels
 *     (angry, fearful, …) fall back to neutral.
 *   - reaction: 250 ms baseline, +1 stress per 3 ms, clamped.
 *
 * Weights: survey 0.5, HR 0.2, face 0.2, reaction 0.1 — renormalized over
 * whichever indicators are actually present.
 *
 * Keep in sync with the web mirror in
 * `mindpulse-web/src/services/assessmentOutcomes.ts` (doctor/admin component
 * bars), which applies the same transforms against stored session columns.
 */

/** Emotion label → raw stress before the confidence pull. */
const FACE_STRESS: Record<string, number> = { happy: 20, neutral: 50, sad: 80 };

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** PSS-10 total (0–100) → stress value on the same scale. */
export const surveyStress = (pssScore: number): number => Math.min(100, Math.max(0, pssScore));

/** Heart rate in bpm → 0–100 stress (60 bpm baseline; higher = more stress). */
export const heartRateStress = (bpm: number): number => Math.min(100, Math.max(0, (bpm - 60) * 2));

/**
 * Detected emotion + scan confidence → 0–100 stress. Returns null when the
 * scan produced no usable expression so the fusion can skip the indicator.
 */
export const faceStress = (
  expression: string | null | undefined,
  confidence: number | null | undefined,
): number | null => {
  if (!expression) return null;
  const base = FACE_STRESS[expression.trim().toLowerCase()] ?? 50;
  return Math.round(50 + (base - 50) * clamp01(confidence ?? 0));
};

/** Average reaction time in ms → 0–100 stress (250 ms baseline). */
export const reactionStress = (averageMs: number): number =>
  Math.min(100, Math.max(0, (averageMs - 250) / 3));

/** One present indicator and the weight it carries before renormalization. */
export interface StressComponent {
  value: number;
  weight: number;
}

/** Weighted blend over the indicators that are present (nulls are skipped). */
export const fuseStressScore = (
  surveyScore: number | null,
  heartRateBpm: number | null,
  faceExpression: string | null,
  faceConfidence: number | null,
  reactionTimeMs: number | null,
): number | null => {
  const components: StressComponent[] = [];
  if (surveyScore != null) components.push({ value: surveyStress(surveyScore), weight: 0.5 });
  if (heartRateBpm != null) components.push({ value: heartRateStress(heartRateBpm), weight: 0.2 });
  const face = faceStress(faceExpression, faceConfidence);
  if (face != null) components.push({ value: face, weight: 0.2 });
  if (reactionTimeMs != null) components.push({ value: reactionStress(reactionTimeMs), weight: 0.1 });

  if (components.length === 0) return null;
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  return components.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight;
};
