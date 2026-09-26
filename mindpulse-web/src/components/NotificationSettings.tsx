import React, { useEffect, useRef, useState } from 'react';
import {
  AdminNotificationPrefs,
  loadAdminNotificationPrefs,
  saveAdminNotificationPrefs,
} from '../services/adminNotificationPrefs';
import './NotificationSettings.css';

type PrefKey = keyof AdminNotificationPrefs;

const ROWS: { key: PrefKey; title: string; subtitle: string }[] = [
  { key: 'emailNotifications', title: 'Email Notifications', subtitle: 'Receive notifications via email' },
  { key: 'pushNotifications', title: 'Push Notifications', subtitle: 'Receive push notifications in your browser' },
  { key: 'smsNotifications', title: 'SMS Notifications', subtitle: 'Receive notifications via text message' },
  { key: 'weeklyReports', title: 'Weekly Reports', subtitle: 'Receive weekly summary reports' },
  { key: 'criticalAlerts', title: 'Critical Alerts', subtitle: 'Receive alerts for high-risk cases' },
];

/**
 * Admin notification preferences (Profile Settings → Notifications).
 * Edits are held in a draft and persisted by Save Preferences; the bell
 * feed honours Critical Alerts immediately after a save.
 */
export const NotificationSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<AdminNotificationPrefs>(() => loadAdminNotificationPrefs());
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const toggle = (key: PrefKey, value: boolean) => {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    saveAdminNotificationPrefs(prefs);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section className="admin-profile-section notification-settings">
      <div className="notification-prefs-card">
        <h2>Notification Preferences</h2>

        {ROWS.map((row) => (
          <label className="notification-prefs-row" key={row.key}>
            <span className="notification-prefs-info">
              <strong>{row.title}</strong>
              <span>{row.subtitle}</span>
            </span>
            <input
              type="checkbox"
              className="notification-prefs-switch"
              checked={prefs[row.key]}
              onChange={(event) => toggle(row.key, event.target.checked)}
            />
          </label>
        ))}

        {saved && <p className="notification-prefs-saved">Preferences saved.</p>}

        <button type="button" className="notification-prefs-save" onClick={save}>
          ▣ Save Preferences
        </button>
      </div>
    </section>
  );
};
