import { AdminResultRow, fetchAdminResults } from './admin';

/**
 * "Review Assessment Outcomes" aggregates the student's completed multi-modal
 * sessions (stress_sessions). Component scores are derived per session and
 * averaged; the formulas mirror the mobile app's fusion weights:
 *
 *   Survey (PSS-10)  survey_score / 2            → 0–50  (survey_score is 0–100)
 *   Heart Rate       (bpm − 55) / 45 clamped ×20 → 0–20  (55 bpm → 0, 100+ → 20)
 *   Facial Analysis  emotion stress map ×20      → 0–20  (angry 1.0 … calm 0.1)
 *   Reaction Time    rt_ms / 2000 clamped ×10    → 0–10  (slower → higher stress)
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
  recent: AdminResultRow[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const EMOTION_STRESS: Record<string, number> = {
  angry: 1,
  mad: 1,
  fearful: 0.85,
  anxious: 0.85,
  stressed: 0.85,
  sad: 0.7,
  surprised: 0.5,
  neutral: 0.4,
  happy: 0.15,
  calm: 0.1,
  relaxed: 0.1,
};

export const surveyComponentOf = (row: AdminResultRow): number | null =>
  row.surveyScore == null ? null : clamp(row.surveyScore / 2, 0, 50);

export const heartRateComponentOf = (row: AdminResultRow): number | null =>
  row.heartRate == null ? null : clamp((row.heartRate - 55) / 45, 0, 1) * 20;

export const facialComponentOf = (row: AdminResultRow): number | null => {
  if (!row.emotion) return null;
  const stress = EMOTION_STRESS[row.emotion.trim().toLowerCase()] ?? 0.5;
  return stress * 20;
};

export const reactionComponentOf = (row: AdminResultRow): number | null =>
  row.reactionTimeMs == null ? null : clamp(row.reactionTimeMs / 2000, 0, 1) * 10;

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
      averageOf(rows, surveyComponentOf, 'survey', 'Survey (PSS-10)', 50),
      averageOf(rows, heartRateComponentOf, 'heartRate', 'Heart Rate', 20),
      averageOf(rows, facialComponentOf, 'facial', 'Facial Analysis', 20),
      averageOf(rows, reactionComponentOf, 'reaction', 'Reaction Time', 10),
    ],
    recent: rows.slice(0, 12),
  };
};
