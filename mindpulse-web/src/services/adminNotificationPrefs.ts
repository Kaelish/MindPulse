export const ADMIN_NOTIFICATION_PREFS_STORAGE_KEY = 'mindpulse.adminNotificationPrefs';

export interface AdminNotificationPrefs {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  weeklyReports: boolean;
  criticalAlerts: boolean;
}

// Matches the admin UI: e-mail, push, weekly reports and critical alerts on;
// SMS off until configured.
export const DEFAULT_ADMIN_NOTIFICATION_PREFS: AdminNotificationPrefs = {
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  weeklyReports: true,
  criticalAlerts: true,
};

export type NotificationRow = {
  type?: string | null;
  title?: string | null;
  message?: string | null;
};

/**
 * Critical Alerts controls high-risk (type = 'alert') rows in the bell feed;
 * the channel toggles (e-mail/push/SMS/weekly) are stored delivery
 * preferences for channels the backend can send.
 */
export const feedNotificationEnabled = (
  row: NotificationRow,
  prefs: AdminNotificationPrefs = loadAdminNotificationPrefs(),
): boolean => row.type !== 'alert' || prefs.criticalAlerts;

export const loadAdminNotificationPrefs = (): AdminNotificationPrefs => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_ADMIN_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(ADMIN_NOTIFICATION_PREFS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_ADMIN_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    // Unreadable storage: fall back to defaults.
  }
  return DEFAULT_ADMIN_NOTIFICATION_PREFS;
};

export const saveAdminNotificationPrefs = (prefs: AdminNotificationPrefs): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ADMIN_NOTIFICATION_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best effort: the toggle still reflects the new state on screen.
  }
};
