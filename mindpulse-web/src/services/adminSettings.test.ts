import {
  ADMIN_SETTINGS_STORAGE_KEY,
  DEFAULT_ADMIN_SETTINGS,
  applyAdminSettings,
  feedNotificationEnabled,
  getPasswordPolicy,
  loadAdminSettings,
  passwordPolicyError,
  saveAdminSettings,
} from './adminSettings';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.body.classList.remove('compact-view');
});

test('returns defaults when nothing is stored', () => {
  expect(loadAdminSettings()).toEqual(DEFAULT_ADMIN_SETTINGS);
});

test('falls back to defaults on corrupted storage', () => {
  window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, '{not json');
  expect(loadAdminSettings()).toEqual(DEFAULT_ADMIN_SETTINGS);
});

test('save then load round-trips and deep-merges partial storage', () => {
  const changed = JSON.parse(JSON.stringify(DEFAULT_ADMIN_SETTINGS)) as typeof DEFAULT_ADMIN_SETTINGS;
  changed.general.darkMode = true;
  changed.notification.highStressAlerts = false;
  saveAdminSettings(changed);

  expect(loadAdminSettings().general.darkMode).toBe(true);
  expect(loadAdminSettings().notification.highStressAlerts).toBe(false);

  // Storage written by an older build that only kept `general` still loads.
  window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify({ general: { compactView: true } }));
  const merged = loadAdminSettings();
  expect(merged.general.compactView).toBe(true);
  expect(merged.detection).toEqual(DEFAULT_ADMIN_SETTINGS.detection);
});

test('default password policy requires 12 characters and a special character', () => {
  expect(getPasswordPolicy()).toEqual({ minLength: 12, requireSpecial: true });
  expect(passwordPolicyError('Pass1234!')).toMatch(/at least 12/);
  expect(passwordPolicyError('abcdefghijkl')).toMatch(/special character/);
  expect(passwordPolicyError('Str0ng!Pass2026')).toBeNull();
});

test('password policy follows the saved Security settings', () => {
  const relaxed = JSON.parse(JSON.stringify(DEFAULT_ADMIN_SETTINGS)) as typeof DEFAULT_ADMIN_SETTINGS;
  relaxed.security.minPasswordLength = '8 characters';
  relaxed.security.requireSpecialChars = false;
  saveAdminSettings(relaxed);

  expect(passwordPolicyError('Pass1234')).toBeNull();
  expect(passwordPolicyError('Pass123')).toMatch(/at least 8/);
});

test('high stress alert toggle gates alert rows in the bell feed', () => {
  expect(feedNotificationEnabled({ type: 'alert' })).toBe(true);
  expect(feedNotificationEnabled({ type: 'info' })).toBe(true);

  const muted = JSON.parse(JSON.stringify(DEFAULT_ADMIN_SETTINGS)) as typeof DEFAULT_ADMIN_SETTINGS;
  muted.notification.highStressAlerts = false;
  expect(feedNotificationEnabled({ type: 'alert' }, muted)).toBe(false);
  expect(feedNotificationEnabled({ type: 'appointment' }, muted)).toBe(true);
});

test('applyAdminSettings sets the theme, density and document title', () => {
  const settings = JSON.parse(JSON.stringify(DEFAULT_ADMIN_SETTINGS)) as typeof DEFAULT_ADMIN_SETTINGS;
  settings.general.darkMode = true;
  settings.general.compactView = true;
  settings.general.systemName = 'MindPulse Admin Portal';

  applyAdminSettings(settings);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.body.classList.contains('compact-view')).toBe(true);
  expect(document.title).toBe('MindPulse Admin Portal');
});
