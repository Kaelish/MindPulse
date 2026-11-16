import { supabase } from '../supabase/client';

/**
 * Mobile "Recently Deleted" for notifications.
 *
 * Reads go through the same security-definer RPC the web portal uses —
 * `list_deleted_rows(p_table)` (migration 0042) — because the normal SELECT
 * policy hides archived rows on purpose. The RPC is ownership-scoped, so a
 * doctor or patient only ever sees their own archived notifications; an
 * admin sees every archived row.
 *
 * Restoring is deliberately NOT done here: it reuses `restoreNotification`
 * from ./notifications, which pins the write to the signed-in account the
 * same way `dismissNotification` does. Archive and restore therefore stay
 * symmetric (and both covered by notifications.test.ts).
 */

export interface DeletedNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  /** When it was archived — what the trash list is ordered by. */
  deletedAt: string;
}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

/**
 * Every archived notification the signed-in account may restore, newest
 * archive first. Deliberately failure-proof: a missing RPC grant or an
 * offline device resolves to an empty list rather than throwing, so the
 * trash view degrades to "nothing here" instead of an error dialog.
 */
export const fetchDeletedNotifications = async (): Promise<DeletedNotification[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('list_deleted_rows', { p_table: 'notifications' });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((raw) => ({
      id: String(raw.id ?? ''),
      title: asString(raw.title, 'Notification'),
      message: asString(raw.message),
      type: asString(raw.type, 'info'),
      createdAt: asString(raw.created_at),
      deletedAt: asString(raw.deleted_at),
    }));
  } catch {
    return [];
  }
};

/** Absolute timestamp used in the trash rows, e.g. "Sep 26, 2026, 4:45 PM". */
export const deletedAtLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso ? '' : 'Unknown time';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
