import { AdminResultRow, fetchAdminResults } from './admin';

/**
 * "Review Assessment Outcomes" aggregates the student's completed multi-modal
 * sessions (stress_sessions). Component scores are derived per session and
 * averaged. The transforms mirror the canonical formula in the mobile app's
 * `services/stressFormula.ts` (fix A-6) — each indicator's 0–100 stress value
 * times its fusion weight, so the bar maxes (50/20/20/10) are exactly the
 * weights 0.5/0.2/0.2/0.1 on the 0–100 scale:
 *
 *   Survey Score     survey_score (0–100)          × 0.5 → 0–50
 *   Heart Rate       clamp(|bpm − 70| × 2, 0–100)  × 0.2 → 0–20
 *   Facial Analysis  faceStress(emotion, conf)      × 0.2 → 0–20
 *                    (happy 20, neutral 50, sad 80 — confidence pulls the
 *                     value toward neutral; unknown labels fall back to 50)
 *   Reaction Time    clamp((ms − 250) / 3, 0–100)  × 0.1 → 0–10
 *
 * Keep in sync with mindpulse-mobile/src/services/stressFormula.ts.
 */

export interface ComponentStat {
  key: 'survey' | 'heartRate' | 'facial' | 'reaction';
  label: string;
  avg: number;
  max: number;
  sampleSize: number;
}

export interface AssessmentOutcomes {
  totalThisMonth: number;
  uniqueStudents: number;
  avgOverall: number | null;
  thisWeek: number;
  components: ComponentStat[];
  /** Every session, newest first — the view windows it and can reveal all. */
  recent: AdminResultRow[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Emotion label → raw stress before the confidence pull (mirror of stressFormula.ts). */
const FACE_STRESS: Record<string, number> = { happy: 20, neutral: 50, sad: 80 };

/** Confidence pulls the value toward neutral so an unsure scan barely moves the score. */
const faceStress = (expression: string, confidence: number | null): number => {
  const base = FACE_STRESS[expression.trim().toLowerCase()] ?? 50;
  return Math.round(50 + (base - 50) * clamp(confidence ?? 0, 0, 1));
};

export const surveyComponentOf = (row: AdminResultRow): number | null =>
  row.surveyScore == null ? null : clamp(row.surveyScore, 0, 100) * 0.5;

export const heartRateComponentOf = (row: AdminResultRow): number | null =>
  row.heartRate == null ? null : clamp(Math.abs(row.heartRate - 70) * 2, 0, 100) * 0.2;

export const facialComponentOf = (row: AdminResultRow): number | null => {
  if (!row.emotion) return null;
  return faceStress(row.emotion, row.faceConfidence) * 0.2;
};

export const reactionComponentOf = (row: AdminResultRow): number | null =>
  row.reactionTimeMs == null ? null : clamp((row.reactionTimeMs - 250) / 3, 0, 100) * 0.1;

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const averageOf = (
  rows: AdminResultRow[],
  pick: (row: AdminResultRow) => number | null,
  key: ComponentStat['key'],
  label: string,
  max: number,
): ComponentStat => {
  const values = rows.map(pick).filter((value): value is number => value != null);
  const avg = mean(values);
  return { key, label, avg: avg == null ? 0 : Math.round(avg * 10) / 10, max, sampleSize: values.length };
};

export const fetchAssessmentOutcomes = async (): Promise<AssessmentOutcomes> => {
  const rows = await fetchAdminResults();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const scores = rows.map((row) => row.score).filter((score): score is number => score != null);
  const avgOverall = mean(scores);

  return {
    totalThisMonth: rows.filter((row) => new Date(row.createdAt) >= monthStart).length,
    uniqueStudents: new Set(rows.map((row) => row.studentId)).size,
    avgOverall: avgOverall == null ? null : Math.round(avgOverall * 10) / 10,
    thisWeek: rows.filter((row) => new Date(row.createdAt) >= weekStart).length,
    components: [
      averageOf(rows, surveyComponentOf, 'survey', 'Survey Score', 50),
      averageOf(rows, heartRateComponentOf, 'heartRate', 'Heart Rate', 20),
      averageOf(rows, facialComponentOf, 'facial', 'Facial Analysis', 20),
      averageOf(rows, reactionComponentOf, 'reaction', 'Reaction Time', 10),
    ],
    // Full history, newest first; the view windows the first 12 rows and can
    // reveal everything so older sessions stay reachable.
    recent: rows,
  };
};
