export const ADMIN_SETTINGS_STORAGE_KEY = 'mindpulse.adminSettings';

/**
 * Only settings that are actually enforced somewhere are modelled (A-5):
 *
 *   general.systemName/darkMode/compactView → applyAdminSettings (title, theme, density)
 *   notification.highStressAlerts           → feedNotificationEnabled (bell feed gating)
 *   security.sessionTimeout                 → App.tsx idle-logout timer
 *   security.minPasswordLength/requireSpecialChars → passwordPolicyError (WebAuth)
 *
 * The former `detection`, `dataPrivacy` and the retention/anonymize/GDPR/2FA/
 * IP-whitelist/daily-summary fields were localStorage-only stubs that enforced
 * nothing, so they were removed rather than shipped as fake controls (A-5).
 */
export interface AdminSystemSettings {
  general: {
    systemName: string;
    description: string;
    darkMode: boolean;
    compactView: boolean;
  };
  notification: {
    highStressAlerts: boolean;
  };
  security: {
    sessionTimeout: boolean;
    minPasswordLength: string;
    requireSpecialChars: boolean;
  };
}

export const SYSTEM_VERSION = '2.4.1';

export const DEFAULT_ADMIN_SETTINGS: AdminSystemSettings = {
  general: {
    systemName: 'MindPulse Admin Portal',
    description: 'AI-Based Emotional Stress Detection System Using Facial Analysis',
    darkMode: false,
    compactView: false,
  },
  notification: {
    highStressAlerts: true,
  },
  security: {
    sessionTimeout: true,
    minPasswordLength: '12 characters',
    requireSpecialChars: true,
  },
};

/** Keeps only the fields the settings object still models (drops A-5-removed keys). */
const pickKnown = <T extends object>(defaults: T, stored: unknown): T => {
  const source = (stored ?? {}) as Record<string, unknown>;
  const fallback = defaults as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  Object.keys(defaults).forEach((field) => {
    const value = source[field];
    out[field] = value === undefined ? fallback[field] : value;
  });
  return out as unknown as T;
};

export const loadAdminSettings = (): AdminSystemSettings => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_ADMIN_SETTINGS;
  try {
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdminSystemSettings>;
    // Payloads written before A-5 may still carry the removed sections and
    // fields; they are not read any more, and the next save rewrites a clean
    // object without them.
    return {
      general: pickKnown(DEFAULT_ADMIN_SETTINGS.general, parsed.general),
      notification: pickKnown(DEFAULT_ADMIN_SETTINGS.notification, parsed.notification),
      security: pickKnown(DEFAULT_ADMIN_SETTINGS.security, parsed.security),
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
};

export const saveAdminSettings = (settings: AdminSystemSettings): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best effort: the UI still reflects the chosen values.
  }
};

/** Applies the cross-cutting settings (theme, density, document title). */
export const applyAdminSettings = (settings: AdminSystemSettings): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = settings.general.darkMode ? 'dark' : 'light';
  document.body.classList.toggle('compact-view', settings.general.compactView);
  document.title = settings.general.systemName;
};

/** Password rules currently in effect (Security tab → Password Policy). */
export const getPasswordPolicy = (): { minLength: number; requireSpecial: boolean } => {
  const policy = loadAdminSettings().security;
  return {
    minLength: parseInt(policy.minPasswordLength, 10) || 8,
    requireSpecial: policy.requireSpecialChars,
  };
};

/** Returns an error message when the password violates the policy, else null. */
export const passwordPolicyError = (password: string): string | null => {
  const policy = getPasswordPolicy();
  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters.`;
  }
  if (policy.requireSpecial && !/[^\w\s]/.test(password)) {
    return 'Password must include at least one special character.';
  }
  return null;
};

/** High Stress Alerts toggle gates type = 'alert' rows in the bell feed. */
export const feedNotificationEnabled = (
  row: { type?: string | null },
  settings: AdminSystemSettings = loadAdminSettings(),
): boolean => row.type !== 'alert' || settings.notification.highStressAlerts;
