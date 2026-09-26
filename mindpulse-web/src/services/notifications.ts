import { supabase } from '../supabase/client';
import { AdminSystemSettings, feedNotificationEnabled, loadAdminSettings } from './adminSettings';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export interface FeedNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'appointment';
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

const timeAgo = (iso: string): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Notifications for the bell panel. RLS decides visibility (administrators
 * see every row, per notifications_select); the saved Settings → Notification
 * preferences then filter disabled categories — rows hidden by settings are
 * returned as `hiddenCount` so the UI can say so.
 */
export const fetchFeedNotifications = async (
  limit = 15,
  settings: AdminSystemSettings = loadAdminSettings(),
): Promise<{ notifications: FeedNotification[]; hiddenCount: number }> => {
  if (!supabase) throw notConfigured();

  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, type, read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as NotificationRow[];
  const mapped: FeedNotification[] = rows.map((row) => ({
    id: String(row.id),
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type === 'alert' || row.type === 'appointment' ? row.type : 'info',
    read: Boolean(row.read),
    createdAt: row.created_at,
  }));

  const visible = mapped.filter((row) => feedNotificationEnabled(row, settings));
  return { notifications: visible, hiddenCount: mapped.length - visible.length };
};

export const notificationTimeAgo = timeAgo;
