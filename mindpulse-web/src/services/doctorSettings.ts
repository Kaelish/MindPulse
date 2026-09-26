/**
 * Doctor portal preferences.
 *
 * Stored per browser and kept separate from the admin portal settings, so a
 * doctor's appearance choice never changes what the administrator sees.
 */

export const DOCTOR_SETTINGS_STORAGE_KEY = 'mindpulse.doctorSettings';

export type DoctorLandingView =
  | 'dashboard'
  | 'consultations'
  | 'student-cases'
  | 'assessment-results'
  | 'recommendations';

export interface DoctorPortalSettings {
  /** Dark appearance for the doctor portal only. */
  darkMode: boolean;
  /** View shown when the doctor opens the portal. */
  landingView: DoctorLandingView;
}

const LANDING_VIEWS: DoctorLandingView[] = [
  'dashboard',
  'consultations',
  'student-cases',
  'assessment-results',
  'recommendations',
];

export const defaultDoctorSettings = (): DoctorPortalSettings => ({
  darkMode: false,
  landingView: 'consultations',
});

export const loadDoctorSettings = (): DoctorPortalSettings => {
  const defaults = defaultDoctorSettings();
  if (typeof window === 'undefined' || !window.localStorage) return defaults;
  try {
    const raw = window.localStorage.getItem(DOCTOR_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DoctorPortalSettings>;
    return {
      darkMode: typeof parsed.darkMode === 'boolean' ? parsed.darkMode : defaults.darkMode,
      landingView: LANDING_VIEWS.includes(parsed.landingView as DoctorLandingView)
        ? (parsed.landingView as DoctorLandingView)
        : defaults.landingView,
    };
  } catch {
    return defaults;
  }
};

export const saveDoctorSettings = (settings: DoctorPortalSettings): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DOCTOR_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best effort: the UI still reflects the chosen values.
  }
};

/**
 * Applies the doctor appearance. The attribute only drives styles scoped to
 * `.doctor-scope`, so the admin portal and auth screens are unaffected.
 */
export const applyDoctorSettings = (settings: DoctorPortalSettings): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.doctorTheme = settings.darkMode ? 'dark' : 'light';
};
