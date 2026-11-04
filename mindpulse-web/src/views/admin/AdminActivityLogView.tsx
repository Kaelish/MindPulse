import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import {
  ActivityEntry,
  LOGGED_ENTITIES,
  fetchActivityLog,
} from '../../services/adminActivityLog';
import './AdminActivityLogView.css';

interface AdminActivityLogViewProps {
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
        second: '2-digit',
      });
};

const ENTITY_LABELS: Record<string, string> = {
  profiles: 'Account',
  appointments: 'Appointment',
  stress_sessions: 'Assessment session',
  consultation_notes: 'Consultation note',
};

const entityLabel = (entity: string) => ENTITY_LABELS[entity] ?? entity;

const Summary: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <article className="detection-summary-card neutral">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>
);

/**
 * Admin → Activity log (module M-23, build B-4).
 *
 * Every row is appended by a database trigger (migration 0032), so this view
 * can only ever read: there is a SELECT grant, an administrator-only RLS
 * policy, and no insert/update/delete path from any client.
 */
export const AdminActivityLogView: React.FC<AdminActivityLogViewProps> = ({ onSignOut, onNavigate }) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [entityFilter, setEntityFilter] = useState('All records');
  const [actionFilter, setActionFilter] = useState('All actions');
  const [search, setSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchActivityLog()
      .then((data) => {
        if (active) setEntries(data);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load the activity log.');
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
    return entries.filter((entry) => {
      if (entityFilter !== 'All records' && entry.entity !== entityFilter) return false;
      if (actionFilter !== 'All actions' && entry.action !== actionFilter) return false;
      if (
        term &&
        !`${entry.actorName} ${entry.subjectLabel ?? ''} ${entry.entity} ${entry.entityId}`
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [entries, entityFilter, actionFilter, search]);

  const countOf = (action: string) => entries.filter((entry) => entry.action === action).length;

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="activity" onNavigate={onNavigate} />

      <main className="main-panel activity-log-main">
        <header className="topbar activity-log-topbar">
          <div>
            <h1>Activity Log</h1>
            <p className="page-subtitle">
              What was created, updated, and deleted — written by the database itself, so no app can
              skip it. Newest first.
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
          <Summary label="Entries" value={String(entries.length)} note="Newest 500 shown" />
          <Summary label="Created" value={String(countOf('created'))} note="Rows inserted" />
          <Summary label="Updated" value={String(countOf('updated'))} note="Rows changed" />
          <Summary label="Deleted" value={String(countOf('deleted'))} note="Rows removed" />
        </section>

        <section className="detection-filter-bar">
          <label className="detection-search">
            ⌕
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by person or record"
              aria-label="Search the activity log"
            />
          </label>
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            aria-label="Filter by record type"
          >
            <option>All records</option>
            {LOGGED_ENTITIES.map((entity) => (
              <option key={entity} value={entity}>
                {entityLabel(entity)}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            aria-label="Filter by action"
          >
            <option>All actions</option>
            <option value="created">created</option>
            <option value="updated">updated</option>
            <option value="deleted">deleted</option>
          </select>
        </section>

        {isLoading && (
          <div className="activity-log-panel">
            <div className="loading-state">
              <span className="spinner" />
            </div>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="activity-log-panel">
            <div className="error-state">
              <p>{loadError}</p>
              <button type="button" onClick={retry}>
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !loadError && (
          <section className="activity-log-panel">
            <h2>Recent activity ({visible.length})</h2>
            {visible.length === 0 ? (
              <p className="empty-table">
                {entries.length === 0
                  ? 'Nothing has been recorded yet. Entries appear as soon as an account, booking, assessment, or consultation note changes.'
                  : 'No activity matches your filters.'}
              </p>
            ) : (
              <div className="activity-log-table-wrap">
                <table className="activity-log-table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Who</th>
                      <th scope="col">Action</th>
                      <th scope="col">Record</th>
                      <th scope="col">Row id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatStamp(entry.createdAt)}</td>
                        <td>
                          <strong>{entry.actorName}</strong>
                          {entry.actorName === 'System' && <small>Written by the database</small>}
                        </td>
                        <td>
                          <span className={`log-chip log-chip--${entry.action}`}>{entry.action}</span>
                        </td>
                        <td>
                          <strong>{entityLabel(entry.entity)}</strong>
                          {entry.subjectLabel && <small>{entry.subjectLabel}</small>}
                        </td>
                        <td className="activity-log-row-id">{entry.entityId}</td>
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
