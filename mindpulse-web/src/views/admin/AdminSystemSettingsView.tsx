import React, { useEffect, useRef, useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import {
  AdminSystemSettings,
  SYSTEM_VERSION,
  applyAdminSettings,
  loadAdminSettings,
  saveAdminSettings,
} from '../../services/adminSettings';
import { exportSystemData } from '../../services/dataExport';
import './AdminSystemSettingsView.css';

// A-5: tabs whose controls enforced nothing (Detection, Data & Privacy policy
// toggles) were removed; each remaining tab only holds settings that are read
// by real code paths (see adminSettings.ts for where each one is enforced).
type SettingsTab = 'general' | 'notification' | 'security' | 'data' | 'compliance';

interface AdminSystemSettingsViewProps {
  onSignOut: () => void;
  onNavigate: (view: AdminNavView) => void;
}

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'notification', label: 'Notification' },
  { key: 'security', label: 'Security' },
  { key: 'data', label: 'Data' },
  { key: 'compliance', label: 'Compliance & Audit' },
];

export const AdminSystemSettingsView: React.FC<AdminSystemSettingsViewProps> = ({ onSignOut, onNavigate }) => {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [draft, setDraft] = useState<AdminSystemSettings>(() => loadAdminSettings());
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(loadAdminSettings()));
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [exportState, setExportState] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const flashSaved = () => {
    setSaved('Settings saved.');
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(''), 3000);
  };

  /** Field edited through Edit Settings → Save Changes. */
  const setField = <S extends keyof AdminSystemSettings, K extends keyof AdminSystemSettings[S]>(
    section: S,
    key: K,
    value: AdminSystemSettings[S][K],
  ) => {
    setDraft((current) => {
      const next: AdminSystemSettings = {
        ...current,
        [section]: { ...current[section], [key]: value },
      };
      return next;
    });
    setSaved('');
  };

  /**
   * Field whose switch applies immediately. The toggle is never disabled by
   * the Edit/Save flow, which is reserved for System Information and the
   * minimum password length.
   *
   * Only this field is written to storage, so toggling a switch while the
   * System Information form has unsaved edits does not commit those edits.
   */
  const setAutoField = <S extends keyof AdminSystemSettings, K extends keyof AdminSystemSettings[S]>(
    section: S,
    key: K,
    value: AdminSystemSettings[S][K],
  ) => {
    setDraft((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));

    const stored = JSON.parse(savedSnapshot) as AdminSystemSettings;
    const nextStored: AdminSystemSettings = {
      ...stored,
      [section]: { ...stored[section], [key]: value },
    };
    saveAdminSettings(nextStored);
    applyAdminSettings(nextStored);
    setSavedSnapshot(JSON.stringify(nextStored));
    flashSaved();
  };

  const dirty = JSON.stringify(draft) !== savedSnapshot;

  const save = () => {
    saveAdminSettings(draft);
    applyAdminSettings(draft);
    setSavedSnapshot(JSON.stringify(draft));
    setEditing(false);
    flashSaved();
  };

  const cancelEditing = () => {
    setDraft(JSON.parse(savedSnapshot) as AdminSystemSettings);
    setEditing(false);
    setSaved('');
  };

  const runExport = async () => {
    setExportState('Exporting…');
    try {
      const filename = await exportSystemData();
      setExportState(`Exported ${filename}`);
    } catch (error) {
      setExportState(error instanceof Error ? error.message : 'Export failed.');
    }
  };

  const saveButton = (
    <div className="settings-actions">
      {editing && dirty && <span className="settings-dirty">Unsaved changes</span>}
      {saved && !dirty && <span className="settings-saved">{saved}</span>}
      {editing && dirty && <button type="button" className="settings-button secondary" onClick={cancelEditing}>Cancel</button>}
      <button
        type="button"
        className="settings-button primary"
        onClick={() => editing ? save() : setEditing(true)}
      >
        {editing ? '▣ Save Changes' : 'Edit Settings'}
      </button>
    </div>
  );

  return (
    <div className="admin-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="settings" onNavigate={onNavigate} />
      <main className="admin-main admin-settings-main">
        <header className="admin-settings-header">
          <div>
            <h1>Settings</h1>
            <p>Configure system preferences and parameters</p>
          </div>
          <div className="account-actions">
            <button type="button" className="notification-button" aria-label="Notifications" onClick={() => setShowNotifications((open) => !open)}>
              <NotificationBell />
            </button>
            {showNotifications && <NotificationPanel />}
          </div>
        </header>

        <nav className="settings-tabs" aria-label="Settings sections">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={tab === entry.key ? 'settings-tab active' : 'settings-tab'}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        {tab === 'general' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon">⚙</span>
              <div>
                <h2>System Information</h2>
                <p>Basic system configuration and details</p>
              </div>
            </div>
            <div className="settings-grid-2">
              <label className="settings-field">
                <span>System Name</span>
                <input disabled={!editing} value={draft.general.systemName} onChange={(e) => setField('general', 'systemName', e.target.value)} />
              </label>
              <label className="settings-field">
                <span>Version</span>
                <input disabled value={SYSTEM_VERSION} readOnly className="readonly" />
              </label>
            </div>
            <label className="settings-field">
              <span>System Description</span>
              <input disabled={!editing} value={draft.general.description} onChange={(e) => setField('general', 'description', e.target.value)} />
            </label>

            {saveButton}

            <div className="settings-divider" />

            <div className="settings-card-heading plain">
              <div><h2>Display Preferences</h2></div>
            </div>
            <Toggle
              title="Dark Mode"
              subtitle="Enable dark theme for the interface"
              checked={draft.general.darkMode}
              onChange={(value) => setAutoField('general', 'darkMode', value)}
            />
            <Toggle
              title="Compact View"
              subtitle="Use compact layout for data tables"
              checked={draft.general.compactView}
              onChange={(value) => setAutoField('general', 'compactView', value)}
            />
          </section>
        )}

        {tab === 'notification' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon">◔</span>
              <div>
                <h2>Notification Settings</h2>
                <p>Configure alerts and notification preferences</p>
              </div>
            </div>

            <p className="settings-group-label">Alert Thresholds</p>
            <Toggle
              title="High Stress Alerts"
              subtitle="Notify when high stress is detected"
              checked={draft.notification.highStressAlerts}
              onChange={(value) => setAutoField('notification', 'highStressAlerts', value)}
            />
            {saved && <span className="settings-saved settings-auto-saved">{saved}</span>}
          </section>
        )}

        {tab === 'security' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon">◍</span>
              <div>
                <h2>Security Settings</h2>
                <p>Manage access control and security preferences</p>
              </div>
            </div>

            <p className="settings-group-label">Access Control</p>
            <Toggle
              title="Session Timeout"
              subtitle="Auto-logout after 30 minutes of inactivity"
              checked={draft.security.sessionTimeout}
              onChange={(value) => setAutoField('security', 'sessionTimeout', value)}
            />

            <div className="settings-divider" />
            <div className="settings-card-heading plain"><div><h2>Password Policy</h2></div></div>
            <SelectRow
              label="Minimum Password Length"
              value={draft.security.minPasswordLength}
              options={['8 characters', '12 characters', '16 characters']}
              disabled={!editing}
              onChange={(value) => setField('security', 'minPasswordLength', value)}
            />
            {saveButton}
            <Toggle
              title="Require Special Characters"
              subtitle="Passwords must include special characters"
              checked={draft.security.requireSpecialChars}
              onChange={(value) => setAutoField('security', 'requireSpecialChars', value)}
            />
          </section>
        )}

        {tab === 'data' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon">▤</span>
              <div>
                <h2>Data Export</h2>
                <p>Export all system data for backup or migration purposes</p>
              </div>
            </div>

            <div className="settings-export-row">
              <button type="button" className="settings-button primary" onClick={() => void runExport()}>
                ⇩ Export Data
              </button>
              {exportState && <span className="settings-export-state">{exportState}</span>}
            </div>
          </section>
        )}

        {tab === 'compliance' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon">⚖</span>
              <div>
                <h2>Compliance & Audit</h2>
                <p>Review consent records and system activity history</p>
              </div>
            </div>

            <div className="settings-export-row">
              <button type="button" className="settings-button primary" onClick={() => onNavigate('consents')}>
                Consent Register
              </button>
              <button type="button" className="settings-button primary" onClick={() => onNavigate('activity')}>
                Activity Log
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

const Toggle: React.FC<{ title: string; subtitle: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }> = ({
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}) => (
  <label className="settings-toggle-row">
    <span className="settings-toggle-info">
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </span>
    <input type="checkbox" className="settings-switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

const SelectRow: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
}> = ({ label, value, options, onChange, hint, disabled = false }) => (
  <div className="settings-select-row">
    <div className="settings-select-head">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
    {hint && <p>{hint}</p>}
  </div>
);
