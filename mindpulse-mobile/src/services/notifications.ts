import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { isNotificationEnabled, loadNotificationPrefs } from './notificationPrefs';

export interface FeedNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'alert' | 'appointment';
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string | number;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  read?: boolean | null;
  created_at: string;
}

const SELECT_COLUMNS = 'id, title, message, type, read, created_at';

const toFeedNotification = (row: NotificationRow): FeedNotification => ({
  id: String(row.id),
  title: row.title || 'Notification',
  message: row.message || '',
  type: row.type === 'alert' || row.type === 'appointment' ? row.type : 'info',
  read: Boolean(row.read),
  createdAt: row.created_at,
});

/** Device notification preferences decide visibility (Settings → Notifications). */
const mapVisible = async (rows: NotificationRow[]): Promise<FeedNotification[]> => {
  const prefs = await loadNotificationPrefs();
  return rows.filter((row) => isNotificationEnabled(row, prefs)).map(toFeedNotification);
};

/**
 * The signed-in account. RLS lets staff read every notification row, so each
 * query is additionally pinned to this id: doctors, admins and students each
 * only ever load their own feed.
 */
const requireViewerId = async (): Promise<string> => requireUserId();

/** Latest handful of notifications, newest first (header badge feed). */
export const fetchRecentNotifications = async (limit = 5): Promise<FeedNotification[]> => {
  const userId = await requireViewerId();
  const { data, error } = await supabase
    .from('notifications')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return mapVisible((data ?? []) as NotificationRow[]);
};

/** Complete history for the "See all" sheet: past → recent, no limit. */
export const fetchAllNotifications = async (): Promise<FeedNotification[]> => {
  const userId = await requireViewerId();
  const { data, error } = await supabase
    .from('notifications')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return mapVisible((data ?? []) as NotificationRow[]);
};

/** Unread badge count; silent failure keeps the bell usable offline. */
export const fetchUnreadNotificationCount = async (): Promise<number> => {
  try {
    const userId = await requireViewerId();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, read')
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw new Error(error.message);
    // Same settings filter as the list, so the badge never promises a hidden row.
    const prefs = await loadNotificationPrefs();
    return ((data ?? []) as NotificationRow[]).filter((row) => isNotificationEnabled(row, prefs)).length;
  } catch {
    return 0;
  }
};

/** Marks every unread row as read for the signed-in doctor. */
export const markAllNotificationsRead = async (): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw new Error(error.message);
};

/** Clears a single row's unread dot; pinned to the signed-in account. */
export const markNotificationRead = async (id: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
};

/**
 * Dismiss = delete the row from my own list (B-2). RLS `notifications_delete`
 * already scopes the delete to the signed-in account; the extra `user_id`
 * filter keeps the intent explicit and pins it even if the policy widens.
 */
export const dismissNotification = async (id: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
};

/**
 * True for the rows produced by the chat trigger (`New message from <name>`),
 * which the app routes to the message thread instead of a generic view.
 */
export const isMessageNotification = (notification: { title: string; message?: string }): boolean =>  /^new message from\b/i.test((notification.title || '').trim()) ||
  /\bsent you a message\b/i.test(`${notification.title || ''} ${notification.message || ''}`);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const notificationTimeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} hrs ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Absolute timestamp used in the full history, e.g. "Sep 26, 2026, 4:45 PM". */
export const notificationFullTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const subscribeToMyNotificationFeed = async (
  onInsert: () => void,
): Promise<() => void> => {
  try {
    const userId = await requireUserId();
    const channel = supabase
      .channel(`my-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        onInsert,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
};
