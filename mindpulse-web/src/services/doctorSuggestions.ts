import { supabase } from '../supabase/client';
import { requireUserId } from './session';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export const SUGGESTION_CATEGORIES = [
  'Feature request',
  'System improvement',
  'Issue or bug',
  'Other',
] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type SuggestionPriority = (typeof SUGGESTION_PRIORITIES)[number];

export const SUGGESTION_STATUSES = ['Open', 'In progress', 'Resolved'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface DoctorSuggestion {
  id: string;
  doctorId: string;
  /** Display name of the doctor (admin view only; empty for the doctor's own view). */
  doctorName: string;
  title: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  message: string;
  status: SuggestionStatus;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorSuggestionInput {
  title: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  message: string;
}

interface SuggestionRow {
  id: string;
  doctor_id: string;
  title: string | null;
  category: string | null;
  priority: string | null;
  message: string | null;
  status: string | null;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

const SUGGESTION_COLUMNS =
  'id, doctor_id, title, category, priority, message, status, admin_reply, created_at, updated_at';

const asCategory = (value: string | null): SuggestionCategory =>
  SUGGESTION_CATEGORIES.includes(value as SuggestionCategory)
    ? (value as SuggestionCategory)
    : 'Other';

const asPriority = (value: string | null): SuggestionPriority =>
  SUGGESTION_PRIORITIES.includes(value as SuggestionPriority)
    ? (value as SuggestionPriority)
    : 'Medium';

const asStatus = (value: string | null): SuggestionStatus =>
  SUGGESTION_STATUSES.includes(value as SuggestionStatus)
    ? (value as SuggestionStatus)
    : 'Open';

const mapSuggestionRow = (row: SuggestionRow, doctorName = ''): DoctorSuggestion => ({
  id: row.id,
  doctorId: row.doctor_id,
  doctorName,
  title: row.title ?? '',
  category: asCategory(row.category),
  priority: asPriority(row.priority),
  message: row.message ?? '',
  status: asStatus(row.status),
  adminReply: row.admin_reply ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** The signed-in doctor's own suggestions, newest first. */
export const fetchMySuggestions = async (): Promise<DoctorSuggestion[]> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();
  const { data, error } = await supabase
    .from('doctor_suggestions')
    .select(SUGGESTION_COLUMNS)
    .eq('doctor_id', doctorId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SuggestionRow[]).map((row) => mapSuggestionRow(row));
};

/** Send a suggestion to the clinic admins. */
export const submitSuggestion = async (input: DoctorSuggestionInput): Promise<void> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();
  const { error } = await supabase.from('doctor_suggestions').insert({
    doctor_id: doctorId,
    title: input.title.trim(),
    category: input.category,
    priority: input.priority,
    message: input.message.trim(),
  });
  if (error) throw new Error(error.message);
};

/** Admin view: every suggestion, with the doctor's display name resolved. */
export const fetchAllSuggestions = async (): Promise<DoctorSuggestion[]> => {
  if (!supabase) throw notConfigured();
  const { data, error } = await supabase
    .from('doctor_suggestions')
    .select(SUGGESTION_COLUMNS)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as SuggestionRow[];
  const doctorIds = Array.from(new Set(rows.map((row) => row.doctor_id)));
  const names = new Map<string, string>();
  if (doctorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', doctorIds);
    for (const profile of (profiles ?? []) as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }[]) {
      const name =
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
        profile.email ||
        'Doctor';
      names.set(profile.id, name);
    }
  }

  return rows.map((row) => mapSuggestionRow(row, names.get(row.doctor_id) ?? 'Doctor'));
};

/** Admin action: reply and/or change the status (triggers a doctor notification). */
export const updateSuggestion = async (
  id: string,
  patch: { status?: SuggestionStatus; adminReply?: string },
): Promise<void> => {
  if (!supabase) throw notConfigured();
  const payload: Record<string, unknown> = {};
  if (patch.status) payload.status = patch.status;
  if (patch.adminReply !== undefined) payload.admin_reply = patch.adminReply.trim();
  if (!Object.keys(payload).length) return;
  const { error } = await supabase.from('doctor_suggestions').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
};

/** Doctor action: withdraw a suggestion that has not been handled yet. Soft-delete instead of hard-delete. */
export const withdrawSuggestion = async (id: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();
  const { error } = await supabase
    .from('doctor_suggestions')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: doctorId,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
};
