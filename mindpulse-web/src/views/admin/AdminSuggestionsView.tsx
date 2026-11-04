import React, { useCallback, useEffect, useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import {
  DoctorSuggestion,
  SUGGESTION_STATUSES,
  SuggestionStatus,
  fetchAllSuggestions,
  updateSuggestion,
} from '../../services/doctorSuggestions';
import './AdminSuggestionsView.css';

interface AdminSuggestionsViewProps {
  onSignOut: () => void;
  onNavigate?: (view: AdminNavView) => void;
}

type FilterKey = 'All' | SuggestionStatus;

const FILTERS: FilterKey[] = ['All', ...SUGGESTION_STATUSES];

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

export const AdminSuggestionsView: React.FC<AdminSuggestionsViewProps> = ({ onSignOut, onNavigate }) => {
  const [suggestions, setSuggestions] = useState<DoctorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchAllSuggestions()
      .then((rows) => {
        if (active) setSuggestions(rows);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load suggestions.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const visible = suggestions.filter(
    (item) => activeFilter === 'All' || item.status === activeFilter,
  );

  const countFor = (filter: FilterKey) =>
    filter === 'All' ? suggestions.length : suggestions.filter((item) => item.status === filter).length;

  const saveReply = async (item: DoctorSuggestion, form: HTMLFormElement) => {
    const data = new FormData(form);
    const status = String(data.get('status')) as SuggestionStatus;
    const adminReply = String(data.get('reply') ?? '');
    setSavingId(item.id);
    setActionError('');
    try {
      await updateSuggestion(item.id, { status, adminReply });
      setSuggestions((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, status, adminReply: adminReply.trim() || null }
            : row,
        ),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save your reply.');
    } finally {
      setSavingId(null);
    }
  };

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="suggestions" onNavigate={onNavigate} />

      <main className="main-panel suggestions-admin-main">
        <header className="topbar suggestions-admin-topbar">
          <div>
            <h1>Doctor Suggestions</h1>
            <p className="page-subtitle">
              Suggestions sent by doctors — features, improvements, and issues. Reply and mark them resolved.
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

        <nav className="suggestions-filters" aria-label="Suggestion filters">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={activeFilter === filter ? 'active' : ''}
              onClick={() => setActiveFilter(filter)}
            >
              {filter} ({countFor(filter)})
            </button>
          ))}
        </nav>

        {actionError && (
          <div className="suggestions-banner is-error" role="alert">
            {actionError}
          </div>
        )}

        {isLoading && (
          <div className="suggestions-panel">
            <div className="loading-state">
              <span className="spinner" />
            </div>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="suggestions-panel">
            <div className="error-state">
              <p>{loadError}</p>
              <button type="button" onClick={retry}>Retry</button>
            </div>
          </div>
        )}

        {!isLoading && !loadError && (
          <section className="suggestions-panel">
            {visible.length === 0 ? (
              <p className="empty-table">
                {activeFilter === 'All'
                  ? 'No suggestions yet. Doctors send them from the Suggestions page in their portal.'
                  : `No suggestions with the status “${activeFilter}”.`}
              </p>
            ) : (
              <div className="suggestions-list">
                {visible.map((item) => (
                  <article className="suggestion-card" key={item.id}>
                    <div className="suggestion-card-head">
                      <div>
                        <h2>{item.title || 'Untitled suggestion'}</h2>
                        <span className="suggestion-from">From {item.doctorName}</span>
                      </div>
                      <div className="suggestion-chips">
                        <span className="suggestion-chip">{item.category}</span>
                        <span className={`suggestion-chip priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
                        <span className={`suggestion-chip status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>

                    <p className="suggestion-message">{item.message}</p>
                    <span className="suggestion-date">Sent {formatStamp(item.createdAt)}</span>

                    <form
                      className="suggestion-reply-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveReply(item, event.currentTarget);
                      }}
                    >
                      <label>
                        Reply to {item.doctorName.split(' ')[0] || 'the doctor'}
                        <textarea
                          name="reply"
                          defaultValue={item.adminReply ?? ''}
                          placeholder="Write what you did or need from the doctor…"
                        />
                      </label>
                      <div className="suggestion-reply-actions">
                        <label className="suggestion-status-select">
                          Status
                          <select name="status" defaultValue={item.status}>
                            {SUGGESTION_STATUSES.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          className="suggestion-save-button"
                          disabled={savingId === item.id}
                        >
                          {savingId === item.id ? 'Saving…' : 'Save reply'}
                        </button>
                      </div>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
