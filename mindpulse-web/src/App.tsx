import { useEffect, useMemo, useState } from 'react';
import { DoctorVideoCallPanel } from './components/DoctorVideoCallPanel';
import './App.css';

interface SummaryCard {
  label: string;
  value: string;
  change: string;
  tone: 'blue' | 'green' | 'amber' | 'purple';
}

interface PatientRow {
  id: string;
  name: string;
  age: number;
  condition: string;
  lastVisit: string;
  score: number;
  status: 'Stable' | 'Watch' | 'Critical';
}

interface AppointmentItem {
  id: string;
  time: string;
  patient: string;
  type: 'Video Call' | 'Check-in' | 'Consult';
  doctor: string;
  status: 'Confirmed' | 'Pending' | 'In progress';
}

const summaryCards: SummaryCard[] = [
  { label: 'Patients', value: '1,284', change: '+12.4%', tone: 'blue' },
  { label: 'Appointments', value: '86', change: '+8.1%', tone: 'green' },
  { label: 'Video Calls', value: '42', change: '+15.8%', tone: 'amber' },
  { label: 'Risk Alerts', value: '7', change: '-3.2%', tone: 'purple' },
];

const patientRows: PatientRow[] = [
  { id: 'P-1021', name: 'Ava Thompson', age: 28, condition: 'Stress recovery', lastVisit: 'Today, 9:15 AM', score: 82, status: 'Stable' },
  { id: 'P-1048', name: 'Marcus Lee', age: 34, condition: 'Sleep assessment', lastVisit: 'Today, 10:20 AM', score: 64, status: 'Watch' },
  { id: 'P-1072', name: 'Nina Patel', age: 41, condition: 'Burnout screening', lastVisit: 'Today, 11:00 AM', score: 71, status: 'Watch' },
  { id: 'P-1106', name: 'Joseph Kim', age: 52, condition: 'Critical review', lastVisit: 'Today, 12:30 PM', score: 39, status: 'Critical' },
];

const appointments: AppointmentItem[] = [
  { id: 'A-201', time: '9:00 AM', patient: 'Ava Thompson', type: 'Video Call', doctor: 'Dr. Chen', status: 'Confirmed' },
  { id: 'A-202', time: '10:30 AM', patient: 'Marcus Lee', type: 'Check-in', doctor: 'Dr. Ruiz', status: 'Pending' },
  { id: 'A-203', time: '1:15 PM', patient: 'Nina Patel', type: 'Consult', doctor: 'Dr. Chen', status: 'In progress' },
  { id: 'A-204', time: '3:00 PM', patient: 'Joseph Kim', type: 'Video Call', doctor: 'Dr. Gomez', status: 'Confirmed' },
];

function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        await new Promise<void>((resolve) => setTimeout(resolve, 500));

        if (!isActive) {
          return;
        }
      } catch (loadError) {
        if (isActive) {
          setError('Unable to load the doctor dashboard. Please refresh and try again.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const patientSummary = useMemo(
    () => ({
      active: patientRows.length,
      critical: patientRows.filter((row) => row.status === 'Critical').length,
    }),
    [],
  );

  return (
    <div className="doctor-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div>
            <div className="brand-name">MindPulse</div>
            <div className="brand-subtitle">Doctor Portal</div>
          </div>
        </div>

        <nav className="nav-panel" aria-label="Main sidebar navigation">
          <button className="nav-item active" type="button">
            <span className="nav-icon">⌂</span>
            Dashboard
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">👥</span>
            Patients
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">📅</span>
            Schedule
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">📹</span>
            Calls
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">📈</span>
            Analytics
          </button>
        </nav>

        <div className="sidebar-card">
          <div className="mini-label">Care load</div>
          <div className="mini-metric">68%</div>
          <div className="mini-track">
            <span />
          </div>
          <div className="mini-note">4 patients needing follow-up today</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">Overview</div>
            <h1>Doctor Dashboard</h1>
          </div>

          <div className="header-actions">
            <button type="button" className="ghost-button">Export</button>
            <button type="button" className="primary-button">+ New visit</button>
          </div>
        </header>

        {loading ? (
          <div className="loading-state">
            <div className="spinner" aria-label="Loading dashboard" />
            <p>Loading dashboard data...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : (
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
                  <button type="button" className="text-button">View all</button>
                </div>

                <div className="table-header">
                  <span>Patient</span>
                  <span>Last visit</span>
                  <span>Score</span>
                  <span>Status</span>
                </div>

                <div className="table-body">
                  {patientRows.map((patient) => (
                    <div key={patient.id} className="patient-row">
                      <div className="patient-identity">
                        <div className="avatar">{patient.name.charAt(0)}</div>
                        <div>
                          <div className="patient-name">{patient.name}</div>
                          <div className="patient-meta">
                            {patient.id} · {patient.age} yrs
                          </div>
                        </div>
                      </div>

                      <div className="patient-subtle">{patient.lastVisit}</div>

                      <div className="score-pill">{patient.score}</div>

                      <div className={`status-pill status-${patient.status.toLowerCase()}`}>
                        {patient.status}
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel schedule-panel">
                <div className="panel-header">
                  <h2>Today's schedule</h2>
                  <button type="button" className="text-button">Agenda</button>
                </div>

                <div className="appointment-list">
                  {appointments.map((item) => (
                    <div key={item.id} className="appointment-item">
                      <div className="time-block">{item.time}</div>
                      <div className="appointment-main">
                        <div className="appointment-name">{item.patient}</div>
                        <div className="appointment-meta">
                          {item.type} · {item.doctor}
                        </div>
                      </div>
                      <div className={`status-pill status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {item.status}
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel insight-panel">
                <div className="panel-header">
                  <h2>Quick insights</h2>
                  <button type="button" className="text-button">Update</button>
                </div>

                <div className="insight-stack">
                  <div className="insight-card">
                    <div className="insight-label">Active patients</div>
                    <div className="insight-value">{patientSummary.active}</div>
                  </div>
                  <div className="insight-card warning">
                    <div className="insight-label">Critical watchlist</div>
                    <div className="insight-value">{patientSummary.critical}</div>
                  </div>
                  <div className="insight-card success">
                    <div className="insight-label">Call readiness</div>
                    <div className="insight-value">96%</div>
                  </div>
                </div>
              </article>

              <DoctorVideoCallPanel />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;