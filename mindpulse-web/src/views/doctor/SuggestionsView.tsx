import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  DoctorSuggestion,
  SUGGESTION_CATEGORIES,
  SUGGESTION_PRIORITIES,
  SUGGESTION_STATUSES,
  SuggestionCategory,
  SuggestionPriority,
  SuggestionStatus,
  fetchMySuggestions,
  submitSuggestion,
  withdrawSuggestion,
} from '../../services/doctorSuggestions';
import { DoctorEmpty, DoctorError, DoctorLoading, DoctorNotifications } from '../../components/doctor/DoctorChrome';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusClass = (status: SuggestionStatus) =>
  status === 'Resolved' ? 'recommendation-completed' : '';

export const SuggestionsView: React.FC = () => {
  const [suggestions, setSuggestions] = useState<DoctorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'All' | SuggestionStatus>('All');
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    if (!showForm) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowForm(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchMySuggestions()
      .then((records) => {
        if (active) setSuggestions(records);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your suggestions.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = async () => {
    const records = await fetchMySuggestions();
    setSuggestions(records);
  };

  const visibleSuggestions = suggestions.filter(
    (item) => activeFilter === 'All' || item.status === activeFilter,
  );

  const sendSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSaving(true);
    setFormError('');
    try {
      await submitSuggestion({
        title: String(data.get('title') ?? ''),
        category: String(data.get('category')) as SuggestionCategory,
        priority: String(data.get('priority')) as SuggestionPriority,
        message: String(data.get('message') ?? ''),
      });
      await refresh();
      form.reset();
      setShowForm(false);
      setSaved(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to send the suggestion.');
    } finally {
      setIsSaving(false);
    }
  };

  const withdraw = async (id: string) => {
    setActionError('');
    try {
      await withdrawSuggestion(id);
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to withdraw the suggestion.');
    }
  };

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <main className="main-panel recommendations-main">
      <header className="topbar recommendations-topbar">
        <div>
          <h1>Suggestions</h1>
          <p className="page-subtitle">
            Send the clinic admin your suggestions — new features, improvements, or issues with the system. They reply here.
          </p>
        </div>
        <DoctorNotifications />
      </header>
      <div className="recommendations-toolbar">
        <div className="recommendation-filters">
          {(['All', ...SUGGESTION_STATUSES] as const).map((filter) => (
            <button
              type="button"
              key={filter}
              className={activeFilter === filter ? 'active' : ''}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <button type="button" className="add-recommendation-button" onClick={() => { setFormError(''); setShowForm(true); }}>
          + New suggestion
        </button>
      </div>
      {saved && <div className="recommendation-save-banner" role="status">Suggestion sent to the admin.</div>}
      {actionError && <div className="recommendation-save-banner is-error" role="alert">{actionError}</div>}
      {isLoading && <DoctorLoading label="Loading suggestions…" variant="skeleton" rows={3} />}
      {!isLoading && loadError && <DoctorError message={loadError} onRetry={retry} />}
      {!isLoading && !loadError && (
        <>
          <section className="recommendation-list">
            {visibleSuggestions.map((item) => (
              <article className="recommendation-card" key={item.id}>
                <div className="recommendation-card-content">
                  <div className="recommendation-title-row">
                    <h2>{item.title || 'Untitled suggestion'}</h2>
                    <span className="recommendation-category">{item.category}</span>
                    <span className={`recommendation-priority ${item.priority === 'High' ? 'high' : 'low'}`}>{item.priority}</span>
                  </div>
                  <p>{item.message}</p>
                  {item.adminReply ? (
                    <div className="suggestion-reply">
                      <strong>Admin reply</strong>
                      <p>{item.adminReply}</p>
                    </div>
                  ) : null}
                  <div className="recommendation-meta">
                    <span>Sent: {formatDate(item.createdAt)}</span>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </div>
                  <div className="recommendation-actions">
                    {item.status === 'Open' && (
                      <button type="button" className="edit-recommendation" onClick={() => void withdraw(item.id)}>
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
          {visibleSuggestions.length === 0 && (
            <DoctorEmpty
              title="No suggestions yet"
              description="Use “+ New suggestion” to ask the admin for a feature, an improvement, or to report an issue with the system."
              action={
                <button type="button" className="ghost-button" onClick={() => setShowForm(true)}>
                  New suggestion
                </button>
              }
            />
          )}
        </>
      )}
      {showForm && (
        <div
          className="modal-backdrop"
          ref={backdropRef}
          onMouseDown={(event) => {
            if (event.target === backdropRef.current) setShowForm(false);
          }}
        >
          <form className="recommendation-modal" onSubmit={sendSuggestion}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">To the clinic admin</span>
                <h2>New Suggestion</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>
            <label>
              Title
              <input name="title" required maxLength={120} placeholder="e.g. Add evening consultation slots" />
            </label>
            <label>
              Category
              <select name="category" defaultValue="Feature request">
                {SUGGESTION_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select name="priority" defaultValue="Medium">
                {SUGGESTION_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </label>
            <label>
              Details
              <textarea name="message" required placeholder="Describe what you would like the admin to add, change, or look into." />
            </label>
            {formError && <p className="case-load-error">{formError}</p>}
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? 'Sending…' : 'Send to admin'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
};
