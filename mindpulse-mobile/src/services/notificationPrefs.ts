import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export const NOTIFICATION_PREFS_STORAGE_KEY = 'mindpulse.notificationPrefs';

/**
 * Fired after the preferences are saved so every open bell can rebuild its
 * list and unread badge instead of waiting for a remount.
 */
export const NOTIFICATION_PREFS_CHANGED_EVENT = 'mindpulse:notification-prefs-changed';

export interface NotificationPrefs {
  dailyReminders: boolean;
  reminderTime: string;
  analysisResults: boolean;
  wellnessRecommendations: boolean;
  appointmentReminders: boolean;
  consultationUpdates: boolean;
  systemAnnouncements: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyReminders: true,
  reminderTime: '8:00 PM',
  analysisResults: true,
  wellnessRecommendations: true,
  appointmentReminders: true,
  consultationUpdates: true,
  systemAnnouncements: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export type NotificationRow = {
  type?: string | null;
  title?: string | null;
  message?: string | null;
};

type PrefKey =
  | 'analysisResults'
  | 'wellnessRecommendations'
  | 'appointmentReminders'
  | 'consultationUpdates'
  | 'systemAnnouncements';

/**
 * Maps a notifications row to the preference that controls it, so the
 * toggles in the notification settings actually gate what is shown/created.
 */
export const notificationCategory = (row: NotificationRow): PrefKey => {
  const text = `${row.title ?? ''} ${row.message ?? ''}`.toLowerCase();
  if (row.type === 'appointment' || /appointment|requested a session/.test(text)) {
    return 'appointmentReminders';
  }
  if (/clinician|replied|message|consultation/.test(text)) return 'consultationUpdates';
  if (/wellness|recommend|mindplant|breathing|tip|growth/.test(text)) return 'wellnessRecommendations';
  if (row.type === 'alert' || /stress|assessment|analysis|score/.test(text)) return 'analysisResults';
  return 'systemAnnouncements';
};

export const isNotificationEnabled = (
  row: NotificationRow,
  prefs: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS,
): boolean => prefs[notificationCategory(row)];

export const loadNotificationPrefs = async (): Promise<NotificationPrefs> => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    // Unreadable storage: fall back to defaults.
  }
  return DEFAULT_NOTIFICATION_PREFS;
};

export const saveNotificationPrefs = async (prefs: NotificationPrefs): Promise<void> => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best effort: the toggle still reflects the new state on screen.
  }
  DeviceEventEmitter.emit(NOTIFICATION_PREFS_CHANGED_EVENT, prefs);
};
