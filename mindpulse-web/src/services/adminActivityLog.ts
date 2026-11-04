import { supabase } from '../supabase/client';
import { ProfileLabel, fetchProfileLabels } from './admin';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

/** The four tables whose changes the audit triggers record (migration 0032). */
export const LOGGED_ENTITIES = [
  'profiles',
  'appointments',
  'stress_sessions',
  'consultation_notes',
] as const;
export type LoggedEntity = (typeof LOGGED_ENTITIES)[number];

export const LOG_ACTIONS = ['created', 'updated', 'deleted'] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];

export interface ActivityEntry {
  id: string;
  /** `System` when the change came from the database itself (actor is null). */
  actorName: string;
  action: string;
  entity: string;
  /** Short form of the row's primary key; the log keeps it after the row is gone. */
  entityId: string;
  /** For profile rows, the account the id points at (the log stores ids only). */
  subjectLabel: string | null;
  createdAt: string;
}

interface ActivityRow {
  id: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
}

/** Newest entries only: the register is an oversight view, not a data store. */
const LOG_LIMIT = 500;

const shortId = (id: string | null) => (id ? id.slice(0, 8).toUpperCase() : '—');

/**
 * The read-only activity log (module M-23, build B-4): what was created,
 * updated or deleted, by whom, and when. Rows are appended by database
 * triggers, so the client cannot write here at all — the SELECT grant and the
 * administrator-only policy are the whole of this service.
 */
export const fetchActivityLog = async (): Promise<ActivityEntry[]> => {
  if (!supabase) throw notConfigured();

  const { data, error } = await supabase
    .from('activity_log')
    .select('id, actor, action, entity, entity_id, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LOG_LIMIT);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ActivityRow[];

  // One profiles query resolves both the actors and the profile ids the log
  // points at (entity = 'profiles' rows are account events).
  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.actor, row.entity === 'profiles' ? row.entity_id : null])
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const labels: Map<string, ProfileLabel> = await fetchProfileLabels(profileIds);

  return rows.map((row) => ({
    id: row.id,
    actorName: row.actor ? labels.get(row.actor)?.name ?? shortId(row.actor) : 'System',
    action: row.action,
    entity: row.entity,
    entityId: shortId(row.entity_id),
    subjectLabel:
      row.entity === 'profiles' && row.entity_id
        ? labels.get(row.entity_id)?.name ?? null
        : null,
    createdAt: row.created_at,
  }));
};
