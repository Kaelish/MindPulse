import type { Language, LikertOption, LifestyleDisplayItem, PssDisplayItem, Translations } from './types';
import { en } from './en';
import { fil } from './fil';
import { ceb } from './ceb';

export type { Language, Translations } from './types';

/** Every supported language, in the order shown in the language picker. */
export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'fil', 'ceb'];

export const TRANSLATIONS: Record<Language, Translations> = { en, fil, ceb };

/**
 * Display helpers for the stress survey.
 *
 * The survey screen keeps its own English module-level arrays for scoring and
 * for the doctor-facing `survey_answers` snapshot — these helpers only build
 * what the patient *sees*, so switching language can never change a score or
 * what a doctor reads.
 */

export const part1Display = (t: Translations): PssDisplayItem[] => [
  t.survey.pss.q1,
  t.survey.pss.q2,
  t.survey.pss.q3,
  t.survey.pss.q4,
  t.survey.pss.q5,
  t.survey.pss.q6,
  t.survey.pss.q7,
  t.survey.pss.q8,
  t.survey.pss.q9,
  t.survey.pss.q10,
];

export const part2Display = (t: Translations): LifestyleDisplayItem[] => [
  t.survey.lifestyle.q101,
  t.survey.lifestyle.q102,
  t.survey.lifestyle.q103,
  t.survey.lifestyle.q104,
  t.survey.lifestyle.q105,
  t.survey.lifestyle.q106,
  t.survey.lifestyle.q107,
  t.survey.lifestyle.q108,
];

export const likertDisplay = (t: Translations): LikertOption[] =>
  t.survey.likert.map((label, value) => ({ value, label }));

/** Question shape the survey screen renders (same ids as the English arrays). */
export interface SurveyDisplayQuestion {
  id: number;
  pill: string;
  text: string;
  sub?: string;
  options?: LikertOption[];
}
