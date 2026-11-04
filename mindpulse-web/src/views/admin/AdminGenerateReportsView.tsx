import React, { useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import {
  GeneratedReport,
  REPORT_DEFINITIONS,
  ReportKey,
  generateAdminReport,
} from '../../services/adminReports';
import './AdminRecordsView.css';

interface AdminGenerateReportsViewProps {
  onSignOut: () => void;
  onNavigate: (view: AdminNavView) => void;
}

interface CardState {
  from: string;
  to: string;
  filter: string;
  open: 'date' | 'filter' | null;
  generating: boolean;
  result: GeneratedReport | null;
  error: string;
}

const buildInitialCards = (): Record<ReportKey, CardState> => {
  const cards = {} as Record<ReportKey, CardState>;
  for (const definition of REPORT_DEFINITIONS) {
    cards[definition.key] = {
      from: '',
      to: '',
      filter: definition.filterOptions[0].value,
      open: null,
      generating: false,
      result: null,
      error: '',
    };
  }
  return cards;
};

const rangeLabel = (from: string, to: string) => {
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'Date Range';
};

export const AdminGenerateReportsView: React.FC<AdminGenerateReportsViewProps> = ({ onSignOut, onNavigate }) => {
  const [cards, setCards] = useState<Record<ReportKey, CardState>>(buildInitialCards);
  const [showNotifications, setShowNotifications] = useState(false);

  const update = (key: ReportKey, patch: Partial<CardState>) =>
    setCards((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  const generate = async (key: ReportKey) => {
    const state = cards[key];
    update(key, { generating: true, error: '', result: null });
    try {
      const result = await generateAdminReport(key, { from: state.from, to: state.to, filter: state.filter });
      update(key, { result, generating: false });
    } catch (error) {
      update(key, {
        error: error instanceof Error ? error.message : 'The report could not be generated.',
        generating: false,
      });
    }
  };

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="records" onNavigate={onNavigate} />

      <main className="main-panel records-main">
        <header className="topbar records-topbar">
          <div>
            <h1>Generate Reports</h1>
            <p className="page-subtitle">Create and download various analytical reports</p>
          </div>
          <div className="header-actions">
            <div className="account-actions">
              <button type="button" className="records-primary-button" onClick={() => onNavigate('records')}>
                ← Back
              </button>
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

        <div className="reports-grid">
          {REPORT_DEFINITIONS.map((definition) => {
            const state = cards[definition.key];
            const filterOption =
              definition.filterOptions.find((option) => option.value === state.filter) ??
              definition.filterOptions[0];
            return (
              <article className="reports-card" key={definition.key}>
                <div className="reports-card-head">
                  <span className="reports-icon" aria-hidden="true">
                    {definition.icon}
                  </span>
                  <div>
                    <h3>{definition.title}</h3>
                    <p>{definition.description}</p>
                  </div>
                </div>

                <div className="reports-controls">
                  <div className="reports-control-wrap">
                    <button
                      type="button"
                      className={`reports-control ${state.from || state.to ? 'is-set' : ''} ${
                        state.open === 'date' ? 'is-open' : ''
                      }`}
                      onClick={() => update(definition.key, { open: state.open === 'date' ? null : 'date' })}
                    >
                      ▣ {rangeLabel(state.from, state.to)}
                    </button>
                    {state.open === 'date' && (
                      <>
                        <div className="reports-shield" onClick={() => update(definition.key, { open: null })} />
                        <div className="reports-popover" role="dialog" aria-label="Choose date range">
                          <strong>Date Range</strong>
                          <label className="reports-field">
                            <span>From</span>
                            <input
                              type="date"
                              value={state.from}
                              max={state.to || undefined}
                              onChange={(event) => update(definition.key, { from: event.target.value })}
                            />
                          </label>
                          <label className="reports-field">
                            <span>To</span>
                            <input
                              type="date"
                              value={state.to}
                              min={state.from || undefined}
                              onChange={(event) => update(definition.key, { to: event.target.value })}
                            />
                          </label>
                          <small className="reports-popover-hint">Leave both empty to include all records.</small>
                          <div className="reports-popover-actions">
                            <button
                              type="button"
                              onClick={() => update(definition.key, { from: '', to: '' })}
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              className="reports-popover-apply"
                              onClick={() => update(definition.key, { open: null })}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="reports-control-wrap">
                    <button
                      type="button"
                      className={`reports-control ${state.filter !== definition.filterOptions[0].value ? 'is-set' : ''} ${
                        state.open === 'filter' ? 'is-open' : ''
                      }`}
                      onClick={() => update(definition.key, { open: state.open === 'filter' ? null : 'filter' })}
                    >
                      ⏷ {filterOption.label === 'All levels' || filterOption.label.startsWith('All') ? 'Filter' : filterOption.label}
                    </button>
                    {state.open === 'filter' && (
                      <>
                        <div className="reports-shield" onClick={() => update(definition.key, { open: null })} />
                        <div className="reports-popover" role="dialog" aria-label="Choose filter">
                          <strong>{definition.filterLabel}</strong>
                          <label className="reports-field">
                            <span>Include</span>
                            <select
                              value={state.filter}
                              onChange={(event) => update(definition.key, { filter: event.target.value })}
                            >
                              {definition.filterOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="reports-popover-actions">
                            <button
                              type="button"
                              onClick={() => update(definition.key, { filter: definition.filterOptions[0].value })}
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="reports-popover-apply"
                              onClick={() => update(definition.key, { open: null })}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    className="reports-generate"
                    disabled={state.generating}
                    onClick={() => void generate(definition.key)}
                  >
                    {state.generating ? 'Generating…' : '⇓ Generate'}
                  </button>
                </div>

                {state.error && <p className="reports-note error">{state.error}</p>}
                {!state.error && state.result && (
                  <p className="reports-note success">
                    Downloaded {state.result.filename} · {state.result.rowCount} rows
                  </p>
                )}
                {!state.error && !state.result && (
                  <small className="reports-note hint">
                    {rangeLabel(state.from, state.to)} · {filterOption.label}
                  </small>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
};
