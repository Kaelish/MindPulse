export const ADMIN_SETTINGS_STORAGE_KEY = 'mindpulse.adminSettings';

export interface AdminSystemSettings {
  general: {
    systemName: string;
    description: string;
    darkMode: boolean;
    compactView: boolean;
  };
  detection: {
    sensitivity: number;
    confidenceThreshold: number;
    modelVersion: string;
    scanInterval: string;
    realTimeProcessing: boolean;
    multiFaceDetection: boolean;
  };
  notification: {
    highStressAlerts: boolean;
    systemPerformanceAlerts: boolean;
    dailySummaryReports: boolean;
    primaryEmail: string;
    notificationFrequency: string;
  };
  security: {
    twoFactor: boolean;
    ipWhitelisting: boolean;
    sessionTimeout: boolean;
    minPasswordLength: string;
    requireSpecialChars: boolean;
  };
  dataPrivacy: {
    retentionPeriod: string;
    anonymizeUserData: boolean;
    storeFacialImages: boolean;
    gdprCompliance: boolean;
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
  detection: {
    sensitivity: 75,
    confidenceThreshold: 85,
    modelVersion: 'v2.4 (Latest - Recommended)',
    scanInterval: '5 seconds',
    realTimeProcessing: true,
    multiFaceDetection: false,
  },
  notification: {
    highStressAlerts: true,
    systemPerformanceAlerts: true,
    dailySummaryReports: false,
    primaryEmail: '',
    notificationFrequency: 'Immediate',
  },
  security: {
    twoFactor: true,
    ipWhitelisting: false,
    sessionTimeout: true,
    minPasswordLength: '12 characters',
    requireSpecialChars: true,
  },
  dataPrivacy: {
    retentionPeriod: '90 days',
    anonymizeUserData: false,
    storeFacialImages: false,
    gdprCompliance: true,
  },
};

export const loadAdminSettings = (): AdminSystemSettings => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_ADMIN_SETTINGS;
  try {
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdminSystemSettings>;
    return {
      general: { ...DEFAULT_ADMIN_SETTINGS.general, ...parsed.general },
      detection: { ...DEFAULT_ADMIN_SETTINGS.detection, ...parsed.detection },
      notification: { ...DEFAULT_ADMIN_SETTINGS.notification, ...parsed.notification },
      security: { ...DEFAULT_ADMIN_SETTINGS.security, ...parsed.security },
      dataPrivacy: { ...DEFAULT_ADMIN_SETTINGS.dataPrivacy, ...parsed.dataPrivacy },
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
