import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { CONSENT_TYPES, ConsentRecord, fetchConsentRecords } from '../../services/adminConsent';
import './AdminConsentRegisterView.css';

interface AdminConsentRegisterViewProps {
  onSignOut: () => void;
  onNavigate: (view: AdminNavView) => void;
}

const formatStamp = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

/** "mobile_signup" -> "Mobile sign-up", keeps the raw value readable. */
const sourceLabel = (source: string) =>
  source
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');

const Summary: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <article className="detection-summary-card neutral">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>
);

/**
 * Admin → Consent register (module M-04, build B-3).
 *
 * Read-only by construction: the service only selects, the RLS policy only
 * admits administrators, and migration 0031 grants no UPDATE and no DELETE —
 * proof of consent outlives the account (C-14), so there is deliberately no
 * edit or remove control here.
 */
export const AdminConsentRegisterView: React.FC<AdminConsentRegisterViewProps> = ({
  onSignOut,
  onNavigate,
}) => {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All consent types');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchConsentRecords()
      .then((data) => {
        if (active) setRecords(data);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load consent records.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (typeFilter !== 'All consent types' && record.consentType !== typeFilter) return false;
      if (term && !`${record.userName} ${record.userEmail}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [records, search, typeFilter]);

  const registrations = records.filter((record) => record.consentType === 'registration').length;
  const faceScans = records.length - registrations;
  const accounts = new Set(records.map((record) => record.userId)).size;

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="consents" onNavigate={onNavigate} />

      <main className="main-panel consent-register-main">
        <header className="topbar consent-register-topbar">
          <div>
            <h1>Consent Register</h1>
            <p className="page-subtitle">
              Every proof of consent on file, newest first. Records are written by the apps and the
              database and are never edited or deleted here.
            </p>
          </div>
          <div className="header-actions">
            <div className="account-actions">
              <button
                type="button"
                className="notification-button"
                aria-label="Notifications"
                onClick={() => setShowNotifications((open) => !open)}
              >
                <NotificationBell />
              </button>
              {showNotifications && <NotificationPanel />}
            </div>
          </div>
        </header>

        <section className="detection-summary-grid">
          <Summary label="Proofs on file" value={String(records.length)} note="Consent records" />
          <Summary label="At sign-up" value={String(registrations)} note="Registration consent" />
          <Summary label="Face-scan" value={String(faceScans)} note="Privacy-sheet consent" />
          <Summary label="Accounts" value={String(accounts)} note="With at least one proof" />
        </section>

        <section className="detection-filter-bar">
          <label className="detection-search">
            ⌕
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or e-mail"
              aria-label="Search consent records"
            />
          </label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filter by consent type"
          >
            <option>All consent types</option>
            {CONSENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </section>

        {isLoading && (
          <div className="consent-register-panel">
            <div className="loading-state">
              <span className="spinner" />
            </div>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="consent-register-panel">
            <div className="error-state">
              <p>{loadError}</p>
              <button type="button" onClick={retry}>
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !loadError && (
          <section className="consent-register-panel">
            <h2>Consent records ({visible.length})</h2>
            {visible.length === 0 ? (
              <p className="empty-table">
                {records.length === 0
                  ? 'No consent has been recorded yet. Records appear when someone signs up or accepts the face-scan privacy sheet.'
                  : 'No consent records match your filters.'}
              </p>
            ) : (
              <div className="consent-register-table-wrap">
                <table className="consent-register-table">
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Consent</th>
                      <th scope="col">Version</th>
                      <th scope="col">Granted</th>
                      <th scope="col">Withdrawn</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <strong>{record.userName}</strong>
                          <small>{record.userEmail || 'No e-mail on file'}</small>
                        </td>
                        <td>
                          <span className={`consent-chip consent-chip--${record.consentType}`}>
                            {record.consentType}
                          </span>
                        </td>
                        <td>{record.version}</td>
                        <td>{formatStamp(record.grantedAt)}</td>
                        <td>{record.withdrawnAt ? formatStamp(record.withdrawnAt) : '—'}</td>
                        <td>{sourceLabel(record.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
