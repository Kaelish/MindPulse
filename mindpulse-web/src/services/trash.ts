import { supabase } from '../supabase/client';

/**
 * Recently Deleted (0042).
 *
 * Reads go through the security-definer RPC `list_deleted_rows(p_table)`,
 * because the normal SELECT policies hide archived rows on purpose. Restores
 * write straight to the base table: every UPDATE policy in the schema is
 * ownership-only, so setting deleted_at/deleted_by back to NULL is allowed.
 *
 * Tables that archive with the `is_deleted` flag (0035-0039) must clear that
 * flag too, otherwise the row would be restored but still filtered out.
 */

export type TrashTable =
  | 'stress_sessions'
  | 'notifications'
  | 'recommendations'
  | 'patient_files'
  | 'doctor_suggestions'
  | 'appointments'
  | 'chat_messages'
  | 'video_sessions'
  | 'payments'
  | 'consultation_notes'
  | 'profiles';

/** Tables whose archive state is the is_deleted boolean rather than just deleted_at. */
const FLAG_TABLES: readonly string[] = [
  'stress_sessions',
  'notifications',
  'recommendations',
  'patient_files',
  'doctor_suggestions',
];

export interface TrashItem {
  table: TrashTable;
  id: string;
  deletedAt: string;
  deletedBy: string | null;
  /** Short human name of what was removed. */
  label: string;
  /** Secondary line (who it belonged to / its status), when available. */
  detail: string | null;
  raw: Record<string, unknown>;
}

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

const TABLE_LABELS: Record<TrashTable, string> = {
  stress_sessions: 'Assessment session',
  notifications: 'Notification',
  recommendations: 'Recommendation',
  patient_files: 'Patient file',
  doctor_suggestions: 'Doctor suggestion',
  appointments: 'Appointment',
  chat_messages: 'Chat message',
  video_sessions: 'Video session',
  payments: 'Payment',
  consultation_notes: 'Consultation note',
  profiles: 'Account',
};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/** Best-effort name for a row: prefer a person's name, then a title, then a status. */
const describeRow = (table: TrashTable, row: Record<string, unknown>): { label: string; detail: string | null } => {
  const fullName = asString(row.full_name);
  const first = asString(row.first_name);
  const last = asString(row.last_name);
  const composed = [first, last].filter(Boolean).join(' ').trim();
  const name = fullName ?? (composed || null);
  const title = asString(row.title) ?? asString(row.patient_note) ?? asString(row.message);
  const email = asString(row.email);
  const status = asString(row.status);

  if (table === 'profiles') {
    return { label: name ?? email ?? TABLE_LABELS.profiles, detail: email };
  }
  if (table === 'notifications') {
    return { label: title ?? TABLE_LABELS.notifications, detail: null };
  }
  if (table === 'stress_sessions') {
    const score = typeof row.score === 'number' ? ` — score ${row.score}` : '';
    return { label: `${TABLE_LABELS.stress_sessions}${score}`, detail: null };
  }
  return {
    label: title ?? name ?? TABLE_LABELS[table],
    detail: [name, email, status].filter(Boolean).join(' · ') || null,
  };
};

/**
 * Every archived row the signed-in account is allowed to see, newest first.
 * The RPC returns jsonb so one function covers every table; the shape is
 * the raw snake_case row, mapped here onto TrashItem.
 */
export const fetchTrash = async (table: TrashTable): Promise<TrashItem[]> => {
  if (!supabase) throw notConfigured();
  const { data, error } = await supabase.rpc('list_deleted_rows', { p_table: table });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((raw) => {
    const { label, detail } = describeRow(table, raw);
    const deletedAt = asString(raw.deleted_at) ?? '';
    return {
      table,
      id: String(raw.id ?? ''),
      deletedAt,
      deletedBy: asString(raw.deleted_by),
      label,
      detail,
      raw,
    };
  });
};

/**
 * Puts archived rows back: deleted_at = NULL and deleted_by = NULL, plus
 * is_deleted = FALSE where that flag exists. They become visible in every
 * normal list again immediately.
 */
export const restoreTrash = async (items: TrashItem[]): Promise<number> => {
  if (!supabase) throw notConfigured();
  // Plain object rather than a Map: this project targets an ES5 lib, where
  // `for...of` over a Map needs downlevelIteration.
  const byTable: Partial<Record<TrashTable, string[]>> = {};
  for (const item of items) {
    if (!item.id) continue;
    const bucket = byTable[item.table] ?? [];
    bucket.push(item.id);
    byTable[item.table] = bucket;
  }

  let restored = 0;
  for (const table of Object.keys(byTable) as TrashTable[]) {
    const ids = byTable[table] ?? [];
    if (!ids.length) continue;
    const patch: Record<string, null | boolean> = { deleted_at: null, deleted_by: null };
    if (FLAG_TABLES.includes(table)) patch.is_deleted = false;
    const { error } = await supabase.from(table).update(patch).in('id', ids);
    if (error) throw new Error(error.message);
    restored += ids.length;
  }
  return restored;
};

export const restoreOne = (item: TrashItem): Promise<number> => restoreTrash([item]);

/** Localised-agnostic timestamp label for the trash lists. */
export const formatDeletedAt = (iso: string): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};
