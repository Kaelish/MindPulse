import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { JitsiCallPanel } from '../../components/JitsiCallPanel';
import {
  DashboardMetric,
  DashboardRecentCase,
  DoctorDashboardOverview,
  fetchDoctorDashboardOverview,
} from '../../services/doctorDashboard';
import { WebConsultationItem, fetchWebConsultations } from '../../services/consultations';
import { fetchStudentCases, StudentCaseRecord } from '../../services/studentCases';

interface DoctorDashboardViewProps {
  onViewCase?: (student: StudentCaseRecord) => void;
  onViewAllCases?: () => void;
}

interface StatCard {
  key: string;
  label: string;
  metric: DashboardMetric;
  tone: 'teal' | 'amber' | 'danger' | 'success';
  icon: React.ReactNode;
}

const IconUsers = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.4a3.5 3.5 0 0 0-2.6-3.4" />
    <path d="M15.4 5.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
);

const IconClipboard = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4.5h6a1 1 0 0 1 1 1V7H8V5.5a1 1 0 0 1 1-1Z" />
    <path d="M8 6.5H6.4A1.4 1.4 0 0 0 5 7.9v11.2a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4V7.9a1.4 1.4 0 0 0-1.4-1.4H16" />
    <path d="M8.8 13.2l2 2 4-4.2" />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 8.2v4.4" />
    <path d="M12 15.8h.01" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.4 11.3V12a8.4 8.4 0 1 1-5-7.7" />
    <path d="M20.5 5.2 12 13.7l-2.4-2.4" />
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.6V12l2.8 1.7" />
  </svg>
);

const IconTag = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.6 12.6 11 6.2a2 2 0 0 1 1.4-.6H18a1.4 1.4 0 0 1 1.4 1.4v5.6a2 2 0 0 1-.6 1.4l-6.4 6.4a1.4 1.4 0 0 1-2 0l-5.8-5.8a1.4 1.4 0 0 1 0-2Z" />
    <circle cx="15.4" cy="8.6" r="1.2" />
  </svg>
);

const riskToneClass = (risk: DashboardRecentCase['risk']): string => {
  if (risk === 'High Risk') return 'high';
  if (risk === 'Moderate Risk') return 'moderate';
  if (risk === 'Low Risk') return 'low';
  return 'none';
};

const riskFillPercent = (stress: number | null): number => {
  if (stress == null) return 0;
  return Math.max(4, Math.min(100, stress));
};

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({ onViewCase, onViewAllCases }) => {
  const [data, setData] = useState<DoctorDashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [nextCall, setNextCall] = useState<WebConsultationItem | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [openingCase, setOpeningCase] = useState<string | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showNotifications) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showNotifications]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchDoctorDashboardOverview()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load the doctor dashboard.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    fetchWebConsultations()
      .then((rows) => {
        if (active) setNextCall(rows.find((row) => row.rawStatus === 'confirmed') ?? null);
      })
      .catch(() => {
        if (active) setNextCall(null);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const openCase = useCallback(
    async (item: DashboardRecentCase) => {
      if (!onViewCase || openingCase) return;
      setOpeningCase(item.userId);
      try {
        const list = await fetchStudentCases();
        const match = list.find((row) => row.userId === item.userId);
        if (match) onViewCase(match);
      } catch {
        // Keep the doctor on the dashboard if the case cannot be opened.
      } finally {
        setOpeningCase(null);
      }
    },
    [onViewCase, openingCase],
  );

  const statCards: StatCard[] = data
    ? [
        { key: 'cases', label: 'Active Cases', metric: data.activeCases, tone: 'teal', icon: <IconUsers /> },
        { key: 'pending', label: 'Pending Reviews', metric: data.pendingReviews, tone: 'amber', icon: <IconClipboard /> },
        { key: 'risk', label: 'High Risk Students', metric: data.highRiskStudents, tone: 'danger', icon: <IconAlert /> },
        { key: 'completed', label: 'Completed this week', metric: data.completedThisWeek, tone: 'success', icon: <IconCheck /> },
      ]
    : [];

  return (
    <main className="main-panel">
      <header className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Overview of your assigned cases and pending consultations</p>
        </div>

        <div className="header-actions">
          <div className="doc-bell-wrap" ref={bellRef}>
            <button
              type="button"
              className="notification-button"
              aria-label="Notifications"
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications((open) => !open)}
            >
              <NotificationBell />
              {data && data.unreadNotifications > 0 && (
                <span className="doc-bell-badge">
                  {data.unreadNotifications > 9 ? '9+' : data.unreadNotifications}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="doc-bell-pop">
                <NotificationPanel />
              </div>
            )}
          </div>
        </div>
      </header>

      {isLoading && (
        <div className="loading-state" role="status">
          <div className="spinner" />
          <p>Loading dashboard…</p>
        </div>
      )}

      {!isLoading && loadError && (
        <div className="error-state" role="alert">
          <p>{loadError}</p>
          <button type="button" className="ghost-button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        </div>
      )}

      {!isLoading && !loadError && data && (
        <>
          <section className="dash-stat-grid" aria-label="Summary statistics">
            {statCards.map((card) => (
              <article key={card.key} className={`dash-stat tone-${card.tone}`}>
                <div className="dash-stat-top">
                  <span className="dash-stat-label">{card.label}</span>
                  <span className="dash-stat-icon" aria-hidden="true">{card.icon}</span>
                </div>
                <div className="dash-stat-value">{card.metric.value.toLocaleString()}</div>
                <div className={`dash-stat-note is-${card.metric.note.tone}`}>{card.metric.note.text}</div>
              </article>
            ))}
          </section>

          <section className="dash-panel-grid">
            <article className="panel dash-panel">
              <div className="panel-header">
                <div className="dash-panel-heading">
                  <h2>Recent Cases</h2>
                  <p>Students with the highest latest stress scores</p>
                </div>
                {onViewAllCases && (
                  <button type="button" className="text-button" onClick={onViewAllCases}>
                    View all
                  </button>
                )}
              </div>

              <div className="dash-case-list">
                {data.recentCases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`dash-case ${openingCase === item.userId ? 'is-loading' : ''}`}
                    onClick={() => void openCase(item)}
                    disabled={!onViewCase || openingCase === item.userId}
                  >
                    <span className="avatar">{item.initials}</span>
                    <span className="dash-case-body">
                      <span className="patient-name">{item.name}</span>
                      <span className="dash-case-meta">
                        {item.studentNo} · {item.activityLabel}
                      </span>
                      <span className="dash-case-stress">
                        {item.stress == null ? (
                          'No assessment yet'
                        ) : (
                          <>
                            Stress: <strong>{item.stress}%</strong>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="dash-case-risk">
                      <span className={`risk-badge ${riskToneClass(item.risk)}`}>{item.risk}</span>
                      <span className="risk-track">
                        <span
                          className={`risk-fill is-${riskToneClass(item.risk)}`}
                          style={{ width: `${riskFillPercent(item.stress)}%` }}
                        />
                      </span>
                    </span>
                  </button>
                ))}

                {data.recentCases.length === 0 && (
                  <div className="dash-empty">
                    <span className="dash-empty-mark" aria-hidden="true" />
                    <p className="dash-empty-title">No student cases yet</p>
                    <p className="dash-empty-text">Cases appear here as soon as students register and book a session.</p>
                  </div>
                )}
              </div>
            </article>

            <article className="panel dash-panel">
              <div className="panel-header">
                <div className="dash-panel-heading">
                  <h2>Upcoming Consultations</h2>
                  <p>Your next scheduled sessions</p>
                </div>
              </div>

              <div className="dash-consult-list">
                {data.upcoming.map((item) => (
                  <article key={item.id} className={`dash-consult is-${item.status}`}>
                    <div className="dash-consult-top">
                      <span className="dash-consult-name">{item.patientName}</span>
                      <span className="dash-consult-chip">{item.statusLabel}</span>
                    </div>
                    <div className="dash-consult-line">
                      <IconClock />
                      <span>{item.whenLabel}</span>
                    </div>
                    <div className="dash-consult-line">
                      <IconTag />
                      <span>Type: {item.typeLabel}</span>
                    </div>
                  </article>
                ))}

                {data.upcoming.length === 0 && (
                  <div className="dash-empty">
                    <span className="dash-empty-mark" aria-hidden="true" />
                    <p className="dash-empty-title">No consultations scheduled</p>
                    <p className="dash-empty-text">Approved bookings show up here with their date and session type.</p>
                  </div>
                )}
              </div>
            </article>

            {nextCall && (
              <div className="dash-call-wide">
                <JitsiCallPanel appointment={nextCall} />
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
};
