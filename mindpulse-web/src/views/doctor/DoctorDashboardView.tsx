import React from 'react';
import { DoctorVideoCallPanel } from '../../components/DoctorVideoCallPanel';

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
  { id: 'a6a45e6c-63b3-44e6-895b-98d5dd7', name: 'John Doe', age: 24, condition: 'Stress recovery', lastVisit: 'Today, 3:30 PM', score: 68, status: 'Watch' },
];

const appointments: AppointmentItem[] = [
  { id: 'A-201', time: '3:30 PM', patient: 'John Doe', type: 'Video Call', doctor: 'Dr. Monroe Leclair', status: 'Confirmed' },
];

interface DoctorDashboardViewProps {
  onSignOut: () => void;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({ onSignOut }) => {
  return (
    <main className="main-panel">
      <header className="topbar">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>Doctor Dashboard</h1>
        </div>

        <div className="header-actions">
          <button type="button" className="ghost-button" onClick={onSignOut}>Sign out</button>
          <button type="button" className="ghost-button">Export</button>
          <button type="button" className="primary-button">+ New visit</button>
        </div>
      </header>

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
                      STU-001 · {patient.age} yrs
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
              <div className="insight-value">1</div>
            </div>
            <div className="insight-card warning">
              <div className="insight-label">Critical watchlist</div>
              <div className="insight-value">1</div>
            </div>
            <div className="insight-card success">
              <div className="insight-label">Call readiness</div>
              <div className="insight-value">96%</div>
            </div>
          </div>
        </article>

        <DoctorVideoCallPanel />
      </section>
    </main>
  );
};
