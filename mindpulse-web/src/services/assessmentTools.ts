import { supabase } from '../supabase/client';

export type AssessmentCategory = 'Multi-Modal' | 'Supplementary' | 'Brief';
export type AssessmentStatus = 'active' | 'draft' | 'archived';

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
  category: AssessmentCategory;
  status: AssessmentStatus;
  durationMinutes: number;
  questions: AssessmentToolQuestion[];
  createdAt: string;
}

export interface AssessmentToolInput {
  title: string;
  description: string;
  category: AssessmentCategory;
  status: AssessmentStatus;
  durationMinutes: number;
  questions: AssessmentToolQuestion[];
}

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

interface ToolRow {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  duration_minutes: number;
  questions: AssessmentToolQuestion[];
  created_at: string;
}

const fromRow = (row: ToolRow): AssessmentTool => ({
  id: String(row.id),
  title: row.title,
  description: row.description ?? '',
  category: (row.category as AssessmentCategory) || 'Supplementary',
  status: (row.status as AssessmentStatus) || 'active',
  durationMinutes: Number(row.duration_minutes) || 10,
  questions: Array.isArray(row.questions) ? row.questions : [],
  createdAt: row.created_at,
});

const toRow = (input: AssessmentToolInput) => ({
  title: input.title.trim(),
  description: input.description.trim(),
  category: input.category,
  status: input.status,
  duration_minutes: input.durationMinutes,
  questions: input.questions,
  updated_at: new Date().toISOString(),
});

export const fetchAssessmentTools = async (): Promise<AssessmentTool[]> => {
  if (!supabase) throw notConfigured();
  const { data, error } = await supabase
    .from('assessment_tools')
    .select('id, title, description, category, status, duration_minutes, questions, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ToolRow[]).map(fromRow);
};

export const createAssessmentTool = async (input: AssessmentToolInput): Promise<AssessmentTool> => {
  if (!supabase) throw notConfigured();
  const { data, error } = await supabase.from('assessment_tools').insert(toRow(input)).select().single();
  if (error || !data) throw new Error(error?.message || 'Could not create the assessment.');
  return fromRow(data as ToolRow);
};

export const updateAssessmentTool = async (id: string, input: AssessmentToolInput): Promise<AssessmentTool> => {
  if (!supabase) throw notConfigured();
  const { data, error } = await supabase
    .from('assessment_tools')
    .update(toRow(input))
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Could not update the assessment.');
  return fromRow(data as ToolRow);
};

export const deleteAssessmentTool = async (id: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase.from('assessment_tools').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

/** Next free numeric id for a question inside one tool (ids are per-tool). */
export const nextQuestionId = (questions: AssessmentToolQuestion[]): number =>
  questions.reduce((max, question) => Math.max(max, Number(question.id) || 0), 0) + 1;

/**
 * Prepare the question boxes for saving: trim wording, drop blank boxes and
 * guarantee unique ids. Each question carries its own metadata (reverse flag,
 * pill, custom options) on the object itself — nothing is matched by position,
 * so deleting a middle question can never shift a reverse-scored flag onto a
 * different question.
 */
export const sanitizeQuestions = (questions: AssessmentToolQuestion[]): AssessmentToolQuestion[] => {
  const seen = new Set<number>();
  const cleaned: AssessmentToolQuestion[] = [];
  for (const question of questions) {
    const text = (question.text ?? '').trim();
    if (!text) continue;
    let id = Number(question.id);
    if (!Number.isFinite(id) || id < 1 || seen.has(id)) id = nextQuestionId(cleaned);
    seen.add(id);
    cleaned.push({ ...question, id, text });
  }
  return cleaned;
};
