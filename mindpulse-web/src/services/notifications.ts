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
  category: NotificationCategory;
  read: boolean;
  createdAt: string;
}

export type NotificationCategory =
  | 'users'
  | 'assessment-tools'
  | 'results'
  | 'records'
  | 'analytics'
  | 'settings';

export const NOTIFICATION_CATEGORIES: { value: NotificationCategory; label: string }[] = [
  { value: 'users', label: 'Users' },
  { value: 'assessment-tools', label: 'Assessment Tools' },
  { value: 'results', label: 'Results' },
  { value: 'records', label: 'Records' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'settings', label: 'Settings' },
];

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

export const categoryForNotification = (
  notification: Pick<FeedNotification, 'title' | 'message' | 'type'>,
): NotificationCategory => {
  const content = `${notification.title} ${notification.message}`.toLowerCase();
  if (/assessment tool|assessment-tools|\btool\b|form (edits?|updates?|changes?)|tool performance/.test(content)) return 'assessment-tools';
  if (/stress|score|risk|critical scan|assessment result|\bscan\b|\bresults?\b/.test(content)) return 'results';
  if (notification.type === 'appointment' || /appointment|capacity|registration|account|\buser\b|\bdoctor\b/.test(content)) return 'users';
  if (/record|archive|backup/.test(content)) return 'records';
  if (/analytics|analytic|report|trend/.test(content)) return 'analytics';
  if (/setting|preference|configuration/.test(content)) return 'settings';
  return 'users';
};

export const notificationCategoryForPath = (pathname: string): NotificationCategory | 'all' => {
  const section = pathname.replace(/\/+$/, '').split('/').pop()?.toLowerCase();
  switch (section) {
    case 'users': return 'users';
    case 'assessment-tools':
    case 'assessment': return 'assessment-tools';
    case 'results': return 'results';
    case 'records': return 'records';
    case 'analytics': return 'analytics';
    case 'settings': return 'settings';
    default: return 'all';
  }
};

export const adminPathForNotificationCategory = (category: NotificationCategory | 'all'): string => {
  switch (category) {
    case 'users': return '/users';
    case 'assessment-tools': return '/assessment-tools';
    case 'results': return '/results';
    case 'records': return '/records';
    case 'analytics': return '/analytics';
    case 'settings': return '/settings';
    default: return '/dashboard';
  }
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
    category: categoryForNotification({
      title: row.title,
      message: row.message,
      type: row.type === 'alert' || row.type === 'appointment' ? row.type : 'info',
    }),
    read: Boolean(row.read),
    createdAt: row.created_at,
  }));

  const visible = mapped.filter((row) => feedNotificationEnabled(row, settings));
  return { notifications: visible, hiddenCount: mapped.length - visible.length };
};

export const markFeedNotificationRead = async (id: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
};

export const notificationTimeAgo = timeAgo;
