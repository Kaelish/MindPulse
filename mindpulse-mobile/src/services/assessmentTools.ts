import { supabase } from '../supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AssessmentToolOption {
  value: number;
  label: string;
}

export interface AssessmentToolQuestion {
  id: number;
  text: string;
  pill?: string;
  reverse?: boolean;
  options?: AssessmentToolOption[];
}

export interface AssessmentTool {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  durationMinutes: number;
  questions: AssessmentToolQuestion[];
}

/** Standard 0–4 Likert used when a tool does not define its own options. */
export const DEFAULT_LIKERT: AssessmentToolOption[] = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Almost Never' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Fairly Often' },
  { value: 4, label: 'Very Often' },
];

interface ToolRow {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  duration_minutes: number;
  questions: AssessmentToolQuestion[];
}

/**
 * Active assessments published by the administrator (admin portal →
 * Assessment Tools). Never throws: an offline / RLS failure just means the
 * hub shows no remote cards instead of breaking the assessment flow.
 */
export const fetchActiveAssessmentTools = async (): Promise<AssessmentTool[]> => {
  try {
    const { data, error } = await supabase
      .from('assessment_tools')
      .select('id, title, description, category, status, duration_minutes, questions')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ToolRow[]).map((row) => ({
      id: String(row.id),
      title: row.title,
      description: row.description ?? '',
      category: row.category ?? 'Supplementary',
      status: row.status ?? 'active',
      durationMinutes: Number(row.duration_minutes) || 10,
      questions: Array.isArray(row.questions) ? row.questions : [],
    }));
  } catch (error) {
    console.warn('Could not load assessment tools', error);
    return [];
  }
};

/**
 * Score 0–100 (higher = more stress) using the tool's own questions.
 * Reverse-scored items (PSS-10 style) contribute `maxOption − raw`.
 */
export const scoreToolAnswers = (
  questions: AssessmentToolQuestion[],
  answers: Record<number, number>,
): number => {
  if (!questions.length) return 0;
  let earned = 0;
  let possible = 0;
  for (const question of questions) {
    const options = question.options?.length ? question.options : DEFAULT_LIKERT;
    const maxOption = Math.max(...options.map((option) => option.value));
    const raw = answers[question.id] ?? 0;
    earned += question.reverse ? maxOption - raw : raw;
    possible += maxOption;
  }
  if (possible <= 0) return 0;
  return Math.round((earned / possible) * 100);
};

const COMPLETION_KEY = 'assessment_tool_completions';

export const loadToolCompletions = async (): Promise<Record<string, string>> => {
  try {
    const json = await AsyncStorage.getItem(COMPLETION_KEY);
    if (json) return JSON.parse(json) as Record<string, string>;
  } catch (error) {
    console.warn('Failed to load assessment completions', error);
  }
  return {};
};

export const recordToolCompletion = async (toolId: string): Promise<void> => {
  try {
    const current = await loadToolCompletions();
    current[toolId] = new Date().toISOString();
    await AsyncStorage.setItem(COMPLETION_KEY, JSON.stringify(current));
  } catch (error) {
    console.warn('Failed to record assessment completion', error);
  }
};
