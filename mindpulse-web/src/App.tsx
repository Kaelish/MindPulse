import { useEffect, useMemo, useState } from 'react';
import { DoctorVideoCallPanel } from './components/DoctorVideoCallPanel';
import { supabase } from './supabase/client';
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

  type DoctorView = 'dashboard' | 'student-cases' | 'assessment-results' | 'consultations' | 'recommendations';
  const [activeView, setActiveView] = useState<DoctorView>('dashboard');

  const renderDoctorPanel = () => {
    if (activeView === 'student-cases') {
      return (
        <div className="doctor-view-panel">
          <div className="doctor-view-header">
            <h2>Student Cases</h2>
            <button type="button" className="text-button">Back to cases</button>
          </div>
          <div className="case-list">
            {patientRows.slice(0, 3).map((patient) => (
              <div key={patient.id} className="case-card">
                <div className="case-avatar">{patient.name.charAt(0)}</div>
                <div className="case-content">
                  <div className="case-name-row">
                    <strong>{patient.name}</strong>
                    <span className={`status-pill status-${patient.status.toLowerCase()}`}>{patient.status}</span>
                  </div>
                  <p>{patient.condition}</p>
                  <div className="case-meta-row">
                    <span>{patient.id}</span>
                    <span>{patient.score}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeView === 'assessment-results') {
      return (
        <div className="doctor-view-panel">
          <div className="doctor-view-header">
            <h2>Assessment Results</h2>
            <button type="button" className="text-button">Filter</button>
          </div>
          <div className="results-grid">
            {patientRows.map((patient) => (
              <div key={patient.id} className="result-card">
                <div className="result-topline">
                  <strong>{patient.name}</strong>
                  <span className={`status-pill status-${patient.status.toLowerCase()}`}>{patient.status}</span>
                </div>
                <p>{patient.condition}</p>
                <div className="result-score">{patient.score}%</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeView === 'consultations') {
      return (
        <div className="doctor-view-panel">
          <div className="doctor-view-header">
            <h2>Consultations</h2>
            <button type="button" className="text-button">New</button>
          </div>
          <div className="consultation-list">
            {appointments.map((item) => (
              <div key={item.id} className="consultation-card">
                <div>
                  <strong>{item.patient}</strong>
                  <p>{item.type}</p>
                </div>
                <span>{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeView === 'recommendations') {
      return (
        <div className="doctor-view-panel">
          <div className="doctor-view-header">
            <h2>Recommendations</h2>
            <button type="button" className="text-button">Add</button>
          </div>
          <div className="recommendation-list">
            {patientRows.slice(0, 2).map((patient) => (
              <div key={patient.id} className="recommendation-card">
                <strong>{patient.name}</strong>
                <p>Suggested follow-up plan for {patient.condition.toLowerCase()}.</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
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
    );
  };

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
          {[
            { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
            { key: 'student-cases', label: 'Student Cases', icon: '👥' },
            { key: 'assessment-results', label: 'Assessment Results', icon: '▣' },
            { key: 'consultations', label: 'Consultations', icon: '📅' },
            { key: 'recommendations', label: 'Recommendations', icon: '📈' },
          ].map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeView === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveView(item.key as DoctorView)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
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
            <h1>{activeView === 'dashboard' ? 'Doctor Dashboard' : activeView.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</h1>
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
          renderDoctorPanel()
        )}
      </main>
    </div>
  );
}

type WebScreen = 'register' | 'login' | 'forgot' | 'reset' | 'roles' | 'admin' | 'doctor';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-panel-left">
          <div className="auth-brand auth-brand-large"><span className="brand-mark">M</span><span>MindPulse</span></div>
          <div className="auth-hero-copy">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <ul className="feature-list">
            <li>Real-time Stress Detection</li>
            <li>Comprehensive Analytics</li>
            <li>Privacy First</li>
          </ul>
        </div>

        <div className="auth-panel-right">
          <div className="auth-inner">{children}</div>
        </div>
      </section>
    </main>
  );
}

function AuthInput({ label, type = 'text', placeholder, value, onChange }: { label: string; type?: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  const inputId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <label className="auth-field" htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} type={type} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function WebAuth({ screen, setScreen }: { screen: WebScreen; setScreen: (screen: WebScreen) => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Please complete all fields to create your account.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add your project URL and publishable key first.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setScreen('roles');
    } catch (error) {
      setErrorMessage('Unable to create your account right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add your project URL and publishable key first.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setScreen('roles');
    } catch (error) {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (screen === 'register') {
    return <AuthShell title="Start Your Journey with MindPulse" subtitle="Join leading organizations in transforming mental health monitoring through AI-powered facial analysis.">
      <div className="auth-topbox">
        <h3>Create Account</h3>
        <p>Sign up to get started with MindPulse admin portal</p>
        <div className="social-row">
          <button type="button" className="social-btn">Google</button>
          <button type="button" className="social-btn">Facebook</button>
        </div>
        <div className="auth-divider"><span>or continue with</span></div>
      </div>

      <form className="auth-form" onSubmit={handleRegister}>
        <AuthInput label="Full name" placeholder="Full name" value={fullName} onChange={setFullName} />
        <AuthInput label="Email address" type="email" placeholder="Email address" value={email} onChange={setEmail} />
        <AuthInput label="Password" type="password" placeholder="Password" value={password} onChange={setPassword} />
        {errorMessage && <p className="auth-error">{errorMessage}</p>}
        <label className="checkbox-row"><input type="checkbox" /><span>I agree to MindPulse Terms &amp; Conditions.</span></label>
        <button className="auth-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'}</button>
      </form>
      <p className="auth-switch">Already have an account? <button type="button" onClick={() => setScreen('login')}>Sign in</button></p>
    </AuthShell>;
  }

  if (screen === 'forgot' || screen === 'reset') {
    const isReset = screen === 'reset';
    return <AuthShell title={isReset ? 'Create New Password' : 'Reset Your Password'} subtitle={isReset ? 'Choose a strong password to protect your MindPulse admin account.' : "Don't worry, it happens to the best of us. Enter your email and we'll send you a link to reset your password."}>
      <div className="auth-topbox minimal">
        <button type="button" className="back-link" onClick={() => setScreen('login')}>&larr; Back to Sign In</button>
        <h3>{isReset ? 'Reset Password' : 'Forgot Password?'}</h3>
        <p>{isReset ? 'Please enter your new password below.' : 'No problem! Enter your email address and we\'ll send you instructions to reset your password.'}</p>
      </div>

      <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setScreen(isReset ? 'login' : 'reset'); }}>
        {!isReset && <AuthInput label="Email Address" type="email" placeholder="admin@mindpulse.com" value={email} onChange={setEmail} />}
        {isReset && <><AuthInput label="New Password" type="password" placeholder="Enter new password" value={password} onChange={setPassword} /><AuthInput label="Confirm New Password" type="password" placeholder="Re-enter new password" value={password} onChange={setPassword} /></>}
        <button className="auth-primary" type="submit">{isReset ? 'Reset Password' : 'Send Reset Link'}</button>
      </form>
      <p className="auth-switch">Remember your password? <button type="button" onClick={() => setScreen('login')}>Sign In</button></p>
    </AuthShell>;
  }

  return <AuthShell title="Welcome Back to MindPulse" subtitle="AI-Based Emotional Stress Detection System Using Facial Analysis.">
    <div className="auth-topbox">
      <h3>Sign In</h3>
      <p>Sign up to get started with MindPulse admin portal</p>
      <div className="social-row">
        <button type="button" className="social-btn">Google</button>
        <button type="button" className="social-btn">Facebook</button>
      </div>
      <div className="auth-divider"><span>or continue with</span></div>
    </div>

    <form className="auth-form" onSubmit={handleLogin}>
      <AuthInput label="Email Address" type="email" placeholder="Email Address" value={email} onChange={setEmail} />
      <AuthInput label="Password" type="password" placeholder="Password" value={password} onChange={setPassword} />
      {errorMessage && <p className="auth-error">{errorMessage}</p>}
      <label className="checkbox-row"><input type="checkbox" /><span>I agree to MindPulse Terms &amp; Conditions.</span></label>
      <button className="auth-link auth-inline-link" type="button" onClick={() => setScreen('forgot')}>Forgot password?</button>
      <button className="auth-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
    </form>
    <p className="auth-switch">Don&apos;t have an account? <button type="button" onClick={() => setScreen('register')}>Sign Up</button></p>
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