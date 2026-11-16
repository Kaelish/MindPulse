import React, { useEffect, useState } from 'react';
import {
  applyDoctorSettings,
  defaultDoctorSettings,
  DoctorLandingView,
  DoctorPortalSettings,
  loadDoctorSettings,
  saveDoctorSettings,
} from '../../services/doctorSettings';
import { DoctorNotifications } from '../../components/doctor/DoctorChrome';
import { DOCTOR_TRASH_CATEGORIES, RecentlyDeletedPanel } from '../../components/RecentlyDeletedPanel';

const LANDING_OPTIONS: { value: DoctorLandingView; label: string }[] = [
  { value: 'consultations', label: 'Consultations' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'student-cases', label: 'Patient Cases' },
  { value: 'assessment-results', label: 'Assessment Results' },
  { value: 'recommendations', label: 'Suggestions' },
];

interface NotificationPrefs {
  email: boolean;
  push: boolean;
  sms: boolean;
  cases: boolean;
}

const NOTIF_PREFS_KEY = 'mindpulse.web.notificationPrefs';

const loadNotifPrefs = (): NotificationPrefs => {
  try {
    const raw = window.localStorage.getItem(NOTIF_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        email: Boolean(parsed.email),
        push: Boolean(parsed.push),
        sms: Boolean(parsed.sms),
        cases: Boolean(parsed.cases),
      };
    }
  } catch {
    // Fall through to defaults.
  }
  return { email: true, push: true, sms: false, cases: true };
};

const NOTIFICATION_ROWS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'email', label: 'Email Notifications', description: 'Email me about consultation activity' },
  { key: 'push', label: 'Push Notifications', description: 'Show browser notifications when available' },
  { key: 'sms', label: 'SMS Notifications', description: 'Text message alerts (not available yet)' },
  { key: 'cases', label: 'New Case Assignments', description: 'Notify me when new cases appear' },
];

export const DoctorSettingsView: React.FC = () => {
  const [draft, setDraft] = useState<DoctorPortalSettings>(() => defaultDoctorSettings());
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(loadNotifPrefs);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadDoctorSettings();
    setDraft(stored);
    setNotifPrefs(loadNotifPrefs());
  }, []);

  const flashSaved = () => {
    setSaved(true);
    setError(null);
    window.setTimeout(() => setSaved(false), 2500);
  };

  /** Dark Mode applies the moment the switch is pressed. */
  const setDarkMode = (value: boolean) => {
    const next: DoctorPortalSettings = { ...draft, darkMode: value };
    setDraft(next);
    try {
      saveDoctorSettings(next);
      applyDoctorSettings(next);
      flashSaved();
    } catch {
      setError('Settings could not be saved in this browser.');
    }
  };

  /** Notification switches persist immediately too. */
  const setNotif = (key: keyof NotificationPrefs) => {
    const next: NotificationPrefs = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    try {
      window.localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));
      flashSaved();
    } catch {
      setError('Settings could not be saved in this browser.');
    }
  };

  const setLanding = (value: DoctorLandingView) => {
    const next: DoctorPortalSettings = { ...draft, landingView: value };
    setDraft(next);
    try {
      saveDoctorSettings(next);
      applyDoctorSettings(next);
      flashSaved();
    } catch {
      setError('Settings could not be saved in this browser.');
    }
  };

  return (
    <main className="main-panel doctor-settings-main">
      <header className="topbar">
        <div>
          <span className="eyebrow">Doctor Portal</span>
          <h1>Settings</h1>
          <p className="page-subtitle">General preferences for your workspace</p>
        </div>
        <div className="header-actions">
          <DoctorNotifications />
        </div>
      </header>

      <form onSubmit={(event) => event.preventDefault()}>
        <section className="doc-settings-card">
          <div className="doc-settings-card-head">
            <h2>Appearance</h2>
            <p>Choose how the portal looks on this device.</p>
          </div>

          <div className="doc-setting-row">
            <div className="doc-setting-copy">
              <strong>Dark Mode</strong>
              <span>Use a dark interface, easier on the eyes during evening sessions.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.darkMode}
              className={`doc-switch ${draft.darkMode ? 'is-on' : ''}`}
              onClick={() => setDarkMode(!draft.darkMode)}
            >
              <span className="doc-switch-knob" />
            </button>
          </div>
        </section>

        <section className="doc-settings-card">
          <div className="doc-settings-card-head">
            <h2>General</h2>
            <p>Set what you see first when you sign in.</p>
          </div>

          <div className="doc-setting-row">
            <div className="doc-setting-copy">
              <strong>Default landing view</strong>
              <span>The page shown when the portal opens.</span>
            </div>
            <select
              className="doc-settings-select"
              value={draft.landingView}
              onChange={(event) => setLanding(event.target.value as DoctorLandingView)}
              aria-label="Default landing view"
            >
              {LANDING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="doc-settings-card">
          <div className="doc-settings-card-head">
            <h2>Notifications</h2>
            <p>Choose what the portal alerts you about. Preferences are saved in this browser; email, push and SMS are not delivered yet.</p>
          </div>

          {NOTIFICATION_ROWS.map((row) => (
            <div className="doc-setting-row" key={row.key}>
              <div className="doc-setting-copy">
                <strong>{row.label}</strong>
                <span>{row.description}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs[row.key]}
                className={`doc-switch ${notifPrefs[row.key] ? 'is-on' : ''}`}
                onClick={() => setNotif(row.key)}
              >
                <span className="doc-switch-knob" />
              </button>
            </div>
          ))}
        </section>

        <section className="doc-settings-card">
          <div className="doc-settings-card-head">
            <h2>Recently Deleted</h2>
            <p>Restore records you have soft-deleted. Nothing here has been permanently erased.</p>
          </div>
          <RecentlyDeletedPanel categories={DOCTOR_TRASH_CATEGORIES} />
        </section>

        {error && <div className="error-inline">{error}</div>}
        {saved && <div className="profile-save-banner">Settings saved.</div>}
      </form>
    </main>
  );
};
