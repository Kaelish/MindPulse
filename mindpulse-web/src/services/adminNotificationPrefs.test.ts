import {
  ADMIN_NOTIFICATION_PREFS_STORAGE_KEY,
  DEFAULT_ADMIN_NOTIFICATION_PREFS,
  feedNotificationEnabled,
  loadAdminNotificationPrefs,
  saveAdminNotificationPrefs,
} from './adminNotificationPrefs';

beforeEach(() => {
  window.localStorage.clear();
});

test('defaults match the notification preferences UI', () => {
  expect(DEFAULT_ADMIN_NOTIFICATION_PREFS).toEqual({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    weeklyReports: true,
    criticalAlerts: true,
  });
});

test('saves and reloads preferences from storage', () => {
  const prefs = {
    emailNotifications: false,
    pushNotifications: true,
    smsNotifications: true,
    weeklyReports: false,
    criticalAlerts: false,
  };
  saveAdminNotificationPrefs(prefs);

  const raw = window.localStorage.getItem(ADMIN_NOTIFICATION_PREFS_STORAGE_KEY);
  expect(raw).toContain('"smsNotifications":true');
  expect(loadAdminNotificationPrefs()).toEqual(prefs);
});

test('falls back to defaults when storage is empty', () => {
  expect(loadAdminNotificationPrefs()).toEqual(DEFAULT_ADMIN_NOTIFICATION_PREFS);
});

test('critical alerts toggle gates high-risk rows in the bell feed', () => {
  const alert = { type: 'alert', title: 'High Stress Alert' };
  const info = { type: 'info', title: 'Service update' };

  expect(feedNotificationEnabled(alert, DEFAULT_ADMIN_NOTIFICATION_PREFS)).toBe(true);
  expect(feedNotificationEnabled(info, DEFAULT_ADMIN_NOTIFICATION_PREFS)).toBe(true);

  const alertsOff = { ...DEFAULT_ADMIN_NOTIFICATION_PREFS, criticalAlerts: false };
  expect(feedNotificationEnabled(alert, alertsOff)).toBe(false);
  expect(feedNotificationEnabled(info, alertsOff)).toBe(true);
});
