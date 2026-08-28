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

function DoctorDashboard({ onSignOut }: { onSignOut: () => void }) {
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
            <button type="button" className="ghost-button" onClick={onSignOut}>Sign out</button>
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

type WebScreen = 'register' | 'login' | 'forgot' | 'reset' | 'roles' | 'admin' | 'doctor';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">M</span><span>MindPulse</span></div>
        <div className="auth-copy"><div className="eyebrow">Care platform</div><h1>{title}</h1><p>{subtitle}</p></div>
        {children}
      </section>
    </main>
  );
}

function AuthInput({ label, type = 'text', placeholder }: { label: string; type?: string; placeholder: string }) {
  return <label className="auth-field"><span>{label}</span><input type={type} placeholder={placeholder} /></label>;
}

function WebAuth({ screen, setScreen }: { screen: WebScreen; setScreen: (screen: WebScreen) => void }) {
  if (screen === 'register') {
    return <AuthShell title="Create your account" subtitle="Start a calmer, more connected care experience.">
      <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setScreen('roles'); }}>
        <AuthInput label="Full name" placeholder="Your full name" />
        <AuthInput label="Email address" type="email" placeholder="you@example.com" />
        <AuthInput label="Password" type="password" placeholder="Create a password" />
        <button className="auth-primary" type="submit">Create account <span>→</span></button>
      </form>
      <p className="auth-switch">Already have an account? <button type="button" onClick={() => setScreen('login')}>Sign in</button></p>
    </AuthShell>;
  }

  if (screen === 'forgot' || screen === 'reset') {
    const isReset = screen === 'reset';
    return <AuthShell title={isReset ? 'Set a new password' : 'Recover your account'} subtitle={isReset ? 'Choose a secure password for your MindPulse account.' : 'We will send a secure reset link to your email.'}>
      <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setScreen(isReset ? 'login' : 'reset'); }}>
        {!isReset && <AuthInput label="Email address" type="email" placeholder="you@example.com" />}
        {isReset && <><AuthInput label="New password" type="password" placeholder="Enter a new password" /><AuthInput label="Confirm password" type="password" placeholder="Repeat your password" /></>}
        <button className="auth-primary" type="submit">{isReset ? 'Save password' : 'Send reset link'} <span>→</span></button>
      </form>
      <p className="auth-switch"><button type="button" onClick={() => setScreen('login')}>Back to sign in</button></p>
    </AuthShell>;
  }

  return <AuthShell title="Welcome back" subtitle="Sign in to continue to your MindPulse workspace.">
    <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setScreen('roles'); }}>
      <AuthInput label="Email address" type="email" placeholder="you@example.com" />
      <AuthInput label="Password" type="password" placeholder="Enter your password" />
      <button className="auth-link" type="button" onClick={() => setScreen('forgot')}>Forgot password?</button>
      <button className="auth-primary" type="submit">Sign in <span>→</span></button>
    </form>
    <p className="auth-switch">New to MindPulse? <button type="button" onClick={() => setScreen('register')}>Create account</button></p>
  </AuthShell>;
}

function RoleSelection({ setScreen }: { setScreen: (screen: WebScreen) => void }) {
  return <AuthShell title="Choose your workspace" subtitle="Select the portal that matches your role.">
    <div className="role-grid">
      <button type="button" className="role-card" onClick={() => setScreen('admin')}><strong>Admin Dashboard</strong><span>Manage users, assessments, and analytics.</span><b>→</b></button>
      <button type="button" className="role-card" onClick={() => setScreen('doctor')}><strong>Doctor Dashboard</strong><span>Review patients, schedules, and consultations.</span><b>→</b></button>
    </div>
  </AuthShell>;
}

function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  return <main className="admin-shell"><aside className="admin-sidebar"><div className="brand-block"><div className="brand-mark">M</div><div><div className="brand-name">MindPulse</div><div className="brand-subtitle">Admin Portal</div></div></div><nav className="nav-panel"><button className="nav-item active" type="button">⌂ Dashboard</button><button className="nav-item" type="button">👥 Users</button><button className="nav-item" type="button">▣ Assessment tools</button><button className="nav-item" type="button">▤ Results</button><button className="nav-item" type="button">◌ Analytics</button></nav></aside><section className="admin-main"><header className="topbar"><div><div className="eyebrow">Overview</div><h1>Admin Dashboard</h1></div><button className="ghost-button" type="button" onClick={onSignOut}>Sign out</button></header><section className="admin-stats"><article><span>Total users</span><strong>2,486</strong><b>+12.4%</b></article><article><span>Assessments completed</span><strong>8,942</strong><b>+18.7%</b></article><article><span>Active clinicians</span><strong>148</strong><b>+6.2%</b></article><article><span>Flagged results</span><strong>32</strong><b>−4.1%</b></article></section><section className="admin-grid"><article className="panel"><div className="panel-header"><h2>Recent activity</h2><button className="text-button" type="button">View all</button></div><div className="admin-list"><div><span className="avatar">A</span><p><strong>Ava Thompson</strong><small>Completed stress assessment</small></p><time>2 min ago</time></div><div><span className="avatar">M</span><p><strong>Marcus Lee</strong><small>New clinician account created</small></p><time>18 min ago</time></div><div><span className="avatar">N</span><p><strong>Nina Patel</strong><small>Result flagged for review</small></p><time>1 hr ago</time></div></div></article><article className="panel admin-health"><div className="panel-header"><h2>System health</h2><span className="status-pill status-stable">Operational</span></div><div className="health-line"><span>API services</span><b>99.98%</b></div><div className="health-line"><span>Assessment pipeline</span><b>98.4%</b></div><div className="health-line"><span>Video consultations</span><b>96.2%</b></div></article></section></section></main>;
}

function App() {
  const [screen, setScreen] = useState<WebScreen>('register');
  const signOut = () => setScreen('login');

  if (screen === 'doctor') return <DoctorDashboard onSignOut={signOut} />;
  if (screen === 'admin') return <AdminDashboard onSignOut={signOut} />;
  if (screen === 'roles') return <RoleSelection setScreen={setScreen} />;
  return <WebAuth screen={screen} setScreen={setScreen} />;
}

export default App;