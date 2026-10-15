import React, { useEffect, useRef, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import {
  AdminSystemSettings,
  DEFAULT_ADMIN_SETTINGS,
  SYSTEM_VERSION,
  applyAdminSettings,
  loadAdminSettings,
  saveAdminSettings,
} from '../../services/adminSettings';
import { exportSystemData } from '../../services/dataExport';
import { fetchOwnProfile } from '../../services/profile';
import './AdminSystemSettingsView.css';

type SettingsTab = 'general' | 'detection' | 'notification' | 'security' | 'data';

interface AdminSystemSettingsViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'suggestions' | 'analytics' | 'profile' | 'settings') => void;
}

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'detection', label: 'Detection' },
  { key: 'notification', label: 'Notification' },
  { key: 'security', label: 'Security' },
  { key: 'data', label: 'Data & Privacy' },
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

  // Prefill the notification e-mail from the signed-in administrator's profile.
  useEffect(() => {
    let active = true;
    fetchOwnProfile()
      .then((profile) => {
        if (!active || !profile.email) return;
        setDraft((current) =>
          current.notification.primaryEmail
            ? current
            : (() => {
                const next = { ...current, notification: { ...current.notification, primaryEmail: profile.email! } };
                setSavedSnapshot(JSON.stringify(next));
                return next;
              })(),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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

  const dirty = JSON.stringify(draft) !== savedSnapshot;

  const save = () => {
    saveAdminSettings(draft);
    applyAdminSettings(draft);
    setSavedSnapshot(JSON.stringify(draft));
    setEditing(false);
    setSaved('Settings saved.');
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(''), 3000);
  };

  const resetToDefault = () => {
    setDraft(JSON.parse(JSON.stringify(DEFAULT_ADMIN_SETTINGS)) as AdminSystemSettings);
    setSaved('');
  };

  const cancelEditing = () => {
    setDraft(JSON.parse(savedSnapshot) as AdminSystemSettings);
    setEditing(false);
    setSaved('');
  };

  const regenerateKey = () => {
    window.confirm(
      'API keys are managed in the Supabase dashboard (Settings → API). Regenerate the publishable key there, then update your .env.local file.',
    );
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
      {saved && <span className="settings-saved">{saved}</span>}
      {editing && tab === 'general' && (
        <button type="button" className="settings-button secondary" onClick={resetToDefault}>
          Reset to Default
        </button>
      )}
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

            <div className="settings-divider" />

            <div className="settings-card-heading plain">
              <div><h2>Display Preferences</h2></div>
            </div>
            <Toggle
              title="Dark Mode"
              subtitle="Enable dark theme for the interface"
              checked={draft.general.darkMode}
              disabled={!editing}
              onChange={(value) => setField('general', 'darkMode', value)}
            />
            <Toggle
              title="Compact View"
              subtitle="Use compact layout for data tables"
              checked={draft.general.compactView}
              disabled={!editing}
              onChange={(value) => setField('general', 'compactView', value)}
            />
            {saveButton}
          </section>
        )}

        {tab === 'detection' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon">⌘</span>
              <div>
                <h2>AI Model Configuration</h2>
                <p>Configure stress detection parameters and thresholds</p>
              </div>
            </div>

            <Slider
              label="Detection Sensitivity"
              value={draft.detection.sensitivity}
              hint="Higher sensitivity may increase false positives"
              disabled={!editing}
              onChange={(value) => setField('detection', 'sensitivity', value)}
            />
            <Slider
              label="Confidence Threshold"
              value={draft.detection.confidenceThreshold}
              hint="Minimum confidence level to record a detection"
              disabled={!editing}
              onChange={(value) => setField('detection', 'confidenceThreshold', value)}
            />

            <SelectRow
              label="AI Model Version"
              value={draft.detection.modelVersion}
              options={['v2.4 (Latest - Recommended)', 'v2.3', 'v2.1']}
              disabled={!editing}
              onChange={(value) => setField('detection', 'modelVersion', value)}
            />
            <SelectRow
              label="Scan Interval"
              value={draft.detection.scanInterval}
              options={['1 second', '5 seconds', '10 seconds', '30 seconds']}
              disabled={!editing}
              onChange={(value) => setField('detection', 'scanInterval', value)}
            />

            <div className="settings-divider" />
            <div className="settings-card-heading plain"><div><h2>Advanced Options</h2></div></div>
            <Toggle
              title="Enable Real-time Processing"
              subtitle="Process facial data in real-time"
              checked={draft.detection.realTimeProcessing}
              disabled={!editing}
              onChange={(value) => setField('detection', 'realTimeProcessing', value)}
            />
            <Toggle
              title="Multi-face Detection"
              subtitle="Detect multiple faces in a single frame"
              checked={draft.detection.multiFaceDetection}
              disabled={!editing}
              onChange={(value) => setField('detection', 'multiFaceDetection', value)}
            />
            {saveButton}
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
              disabled={!editing}
              onChange={(value) => setField('notification', 'highStressAlerts', value)}
            />
            <Toggle
              title="System Performance Alerts"
              subtitle="Notify on system performance issues"
              checked={draft.notification.systemPerformanceAlerts}
              disabled={!editing}
              onChange={(value) => setField('notification', 'systemPerformanceAlerts', value)}
            />
            <Toggle
              title="Daily Summary Reports"
              subtitle="Receive daily summary via email"
              checked={draft.notification.dailySummaryReports}
              disabled={!editing}
              onChange={(value) => setField('notification', 'dailySummaryReports', value)}
            />

            <div className="settings-divider" />
            <div className="settings-card-heading plain"><div><h2>Email Notifications</h2></div></div>
            <div className="settings-email-row">
              <span>Primary Email</span>
              <div className="settings-email-value">
                <span aria-hidden="true">✉</span>
                <input
                  type="email"
                  disabled={!editing}
                  value={draft.notification.primaryEmail}
                  placeholder="admin@mindpulse.ai"
                  onChange={(e) => setField('notification', 'primaryEmail', e.target.value)}
                />
              </div>
            </div>
            <SelectRow
              label="Notification Frequency"
              value={draft.notification.notificationFrequency}
              options={['Immediate', 'Hourly', 'Daily digest']}
              disabled={!editing}
              onChange={(value) => setField('notification', 'notificationFrequency', value)}
            />
            {saveButton}
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
              title="Two-Factor Authentication"
              subtitle="Require 2FA for admin access"
              checked={draft.security.twoFactor}
              disabled={!editing}
              onChange={(value) => setField('security', 'twoFactor', value)}
            />
            <Toggle
              title="IP Whitelisting"
              subtitle="Restrict access to approved IP addresses"
              checked={draft.security.ipWhitelisting}
              disabled={!editing}
              onChange={(value) => setField('security', 'ipWhitelisting', value)}
            />
            <Toggle
              title="Session Timeout"
              subtitle="Auto-logout after 30 minutes of inactivity"
              checked={draft.security.sessionTimeout}
              disabled={!editing}
              onChange={(value) => setField('security', 'sessionTimeout', value)}
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
            <Toggle
              title="Require Special Characters"
              subtitle="Passwords must include special characters"
              checked={draft.security.requireSpecialChars}
              disabled={!editing}
              onChange={(value) => setField('security', 'requireSpecialChars', value)}
            />

            <div className="settings-divider" />
            <div className="settings-card-heading plain"><div><h2>API Keys</h2></div></div>
            <div className="settings-api-key-row">
              <div>
                <strong>Production API Key</strong>
                <code>sb_publishable_••••••••••••••••</code>
              </div>
              <button type="button" className="settings-button secondary" onClick={regenerateKey} disabled={!editing}>
                Regenerate
              </button>
            </div>
            {saveButton}
          </section>
        )}

        {tab === 'data' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon">▤</span>
              <div>
                <h2>Data &amp; Privacy Settings</h2>
                <p>Configure data retention and privacy preferences</p>
              </div>
            </div>

            <p className="settings-group-label">Data Retention</p>
            <SelectRow
              label="Scan Data Retention Period"
              value={draft.dataPrivacy.retentionPeriod}
              options={['30 days', '60 days', '90 days', '1 year', 'Forever']}
              disabled={!editing}
              onChange={(value) => setField('dataPrivacy', 'retentionPeriod', value)}
              hint="Automatically delete scan data after this period"
            />

            <div className="settings-divider" />
            <div className="settings-card-heading plain"><div><h2>Privacy Options</h2></div></div>
            <Toggle
              title="Anonymize User Data"
              subtitle="Remove personally identifiable information"
              checked={draft.dataPrivacy.anonymizeUserData}
              disabled={!editing}
              onChange={(value) => setField('dataPrivacy', 'anonymizeUserData', value)}
            />
            <Toggle
              title="Store Facial Images"
              subtitle="Save original facial images with scan data"
              checked={draft.dataPrivacy.storeFacialImages}
              disabled={!editing}
              onChange={(value) => setField('dataPrivacy', 'storeFacialImages', value)}
            />
            <Toggle
              title="GDPR Compliance Mode"
              subtitle="Enable GDPR-compliant data handling"
              checked={draft.dataPrivacy.gdprCompliance}
              disabled={!editing}
              onChange={(value) => setField('dataPrivacy', 'gdprCompliance', value)}
            />

            <div className="settings-divider" />
            <div className="settings-card-heading plain">
              <div>
                <h2>Data Export</h2>
                <p>Export all system data for backup or migration purposes</p>
              </div>
            </div>
            <div className="settings-export-row">
              <button type="button" className="settings-button primary" onClick={() => void runExport()} disabled={!editing}>
                ⇩ Export Data
              </button>
              {exportState && <span className="settings-export-state">{exportState}</span>}
            </div>
            {saveButton}
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

const Slider: React.FC<{ label: string; value: number; hint: string; onChange: (value: number) => void; disabled?: boolean }> = ({
  label,
  value,
  hint,
  onChange,
  disabled = false,
}) => (
  <div className="settings-slider">
    <span className="settings-slider-label">{label}</span>
    <div className="settings-slider-row">
      <input type="range" min={0} max={100} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <strong>{value}%</strong>
    </div>
    <p>{hint}</p>
  </div>
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
