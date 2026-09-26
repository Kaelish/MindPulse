import React, { useEffect, useMemo, useState } from 'react';
import { JitsiCallPanel } from '../../components/JitsiCallPanel';
import { fetchDoctorDashboard, DoctorDashboardData } from '../../services/doctorDashboard';
import { WebConsultationItem, fetchWebConsultations } from '../../services/consultations';

interface SummaryCard {
  label: string;
  value: string;
  change: string;
  tone: 'blue' | 'green' | 'amber' | 'purple';
}

interface DoctorDashboardViewProps {
  onSignOut: () => void;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({ onSignOut }) => {
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [nextCall, setNextCall] = useState<WebConsultationItem | null>(null);

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

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchDoctorDashboard()
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

  const stats = data?.stats;
  const summaryCards: SummaryCard[] = stats
    ? [
        { label: 'Patients', value: String(stats.patients), change: `${stats.upcoming} upcoming`, tone: 'blue' },
        { label: 'Appointments', value: String(stats.appointments), change: `${stats.assessedWeek} assessed this week`, tone: 'green' },
        { label: 'Video Calls', value: String(stats.videoCalls), change: `${stats.videoCalls} sessions`, tone: 'amber' },
        { label: 'Risk Alerts', value: String(stats.riskAlerts), change: stats.riskAlerts ? `${stats.riskAlerts} critical` : 'None', tone: 'purple' },
      ]
    : [];

  const visiblePatients = useMemo(() => {
    const rows = [...(data?.patients ?? [])];
    rows.sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });
    return rows.slice(0, 6);
  }, [data]);

  const scheduleItems = data?.schedule.slice(0, 5) ?? [];

  return (
    <main className="main-panel">
      <header className="topbar">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>Doctor Dashboard</h1>
        </div>

        <div className="header-actions">
          <button type="button" className="ghost-button" onClick={onSignOut}>Sign out</button>
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

      {!isLoading && !loadError && stats && (
        <>
          <section className="stats-grid" aria-label="Summary statistics">
            {summaryCards.map((card) => (
              <article key={card.label} className={`stat-card tone-${card.tone}`}>
                <div className="stat-label">{card.label}</div>
                <div className="stat-value">{card.value}</div>
                <div className="stat-change">{card.change}</div>
              </article>
            ))}
          </section>

          <section className="content-grid">
            <article className="panel patients-panel">
              <div className="panel-header">
                <h2>Patient list</h2>
              </div>

              <div className="table-header">
                <span>Patient</span>
                <span>Last visit</span>
                <span>Score</span>
                <span>Status</span>
              </div>

              <div className="table-body">
                {visiblePatients.map((patient) => (
                  <div key={patient.id} className="patient-row">
                    <div className="patient-identity">
                      <div className="avatar">{patient.initials}</div>
                      <div>
                        <div className="patient-name">{patient.name}</div>
                        <div className="patient-meta">
                          {patient.studentNo}{patient.age != null ? ` · ${patient.age} yrs` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="patient-subtle">{patient.lastVisit ?? 'No visit yet'}</div>
                    <div className="score-pill">{patient.score ?? '—'}</div>
                    {patient.status === 'Unassessed' ? (
                      <div className="status-pill status-pending">Unassessed</div>
                    ) : (
                      <div className={`status-pill status-${patient.status.toLowerCase()}`}>{patient.status}</div>
                    )}
                  </div>
                ))}
                {visiblePatients.length === 0 && <p className="empty-table">No patients linked to your appointments yet.</p>}
              </div>
            </article>

            <article className="panel schedule-panel">
              <div className="panel-header">
                <h2>Upcoming schedule</h2>
              </div>

              <div className="appointment-list">
                {scheduleItems.map((item) => (
                  <div key={item.id} className="appointment-item">
                    <div className="time-block">{item.dayLabel}</div>
                    <div className="appointment-main">
                      <div className="appointment-name">{item.patientName}</div>
                      <div className="appointment-meta">{item.timeLabel}</div>
                    </div>
                    <div className={item.status === 'Completed' ? 'status-pill status-active' : 'status-pill status-confirmed'}>
                      {item.status}
                    </div>
                  </div>
                ))}
                {scheduleItems.length === 0 && <p className="empty-table">No appointments scheduled.</p>}
              </div>
            </article>

            <article className="panel insight-panel">
              <div className="panel-header">
                <h2>Quick insights</h2>
              </div>

              <div className="insight-stack">
                <div className="insight-card">
                  <div className="insight-label">Active patients</div>
                  <div className="insight-value">{stats.patients}</div>
                </div>
                <div className="insight-card warning">
                  <div className="insight-label">Critical watchlist</div>
                  <div className="insight-value">{stats.riskAlerts}</div>
                </div>
                <div className="insight-card success">
                  <div className="insight-label">Assessed this week</div>
                  <div className="insight-value">{stats.assessedWeek}</div>
                </div>
              </div>
            </article>

            {nextCall ? (
              <JitsiCallPanel appointment={nextCall} />
            ) : (
              <article className="panel call-panel" aria-label="Video consultation">
                <div className="panel-header">
                  <h2>Video consultation</h2>
                </div>
                <div className="call-card">
                  <div className="call-main-label">No confirmed sessions</div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                    Approve a booking in Consultations — once the patient pays, the join-call button
                    for that session appears here.
                  </p>
                </div>
              </article>
            )}
          </section>
        </>
      )}
    </main>
  );
};
