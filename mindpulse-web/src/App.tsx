import { useEffect, useMemo, useState } from 'react';
import { DoctorVideoCallPanel } from './components/DoctorVideoCallPanel';
import { supabase } from './supabase/client';
import {
  WebChatMessage,
  WebConsultationItem,
  fetchWebChatMessages,
  fetchWebConsultations,
  sendWebChatMessage,
} from './services/consultations';
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
  type DoctorView = 'dashboard' | 'student-cases' | 'assessment-results' | 'consultations' | 'recommendations';
  const [activeView, setActiveView] = useState<DoctorView>('consultations');

  // Consultations & Live Messaging State
  const [consultations, setConsultations] = useState<WebConsultationItem[]>([]);
  const [consultTab, setConsultTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [activeSessionItem, setActiveSessionItem] = useState<WebConsultationItem | null>(null);
  const [webChatMessages, setWebChatMessages] = useState<WebChatMessage[]>([]);
  const [webInputMessage, setWebInputMessage] = useState<string>('');
  const [showVideoCall, setShowVideoCall] = useState<boolean>(false);

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const fetchedConsultations = await fetchWebConsultations();
        if (isActive) {
          setConsultations(fetchedConsultations);
        }
      } catch (loadError) {
        if (isActive) {
          setError('Unable to load consultations. Please try again.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, []);

  // Poll Supabase chat messages in real time when live session modal is active
  useEffect(() => {
    if (!activeSessionItem) return;

    let isSubscribed = true;

    const loadMessages = async () => {
      const msgs = await fetchWebChatMessages(activeSessionItem.id);
      if (isSubscribed) {
        setWebChatMessages(msgs);
      }
    };

    void loadMessages();
    const interval = setInterval(loadMessages, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeSessionItem]);

  const handleSendWebMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!webInputMessage.trim() || !activeSessionItem) return;

    const text = webInputMessage.trim();
    setWebInputMessage('');

    const newMsg = await sendWebChatMessage(activeSessionItem.id, 'doctor', text);
    setWebChatMessages((prev) => [...prev, newMsg]);
  };

  const upcomingConsultations = useMemo(
    () => consultations.filter((c) => c.status !== 'Completed'),
    [consultations],
  );

  const completedConsultations = useMemo(
    () => consultations.filter((c) => c.status === 'Completed'),
    [consultations],
  );

  const patientSummary = useMemo(
    () => ({
      active: patientRows.length,
      critical: patientRows.filter((row) => row.status === 'Critical').length,
    }),
    [],
  );

  return (
    <div className="doctor-shell">
      {/* Sidebar matching screenshot design */}
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

        {/* Doctor Monroe Profile Footer Card */}
        <div className="sidebar-profile-card">
          <div className="sidebar-profile-top">
            <div className="sidebar-doctor-avatar">👤</div>
            <div className="sidebar-doctor-info">
              <div className="sidebar-doctor-name">Doctor Monroe</div>
              <div className="sidebar-doctor-email">dr.monroeLeclair@gmail.com</div>
              <div className="sidebar-doctor-spec">Clinical Psychologist</div>
            </div>
          </div>
          <button type="button" className="sidebar-signout-btn" onClick={onSignOut}>
            ➔ Sign Out
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      {activeView === 'consultations' ? (
        /* CONSULTATIONS SCREEN MATCHING MEDIA_1788161347804.PNG */
        <div className="consultations-page">
          {/* Header */}
          <header className="consultations-header">
            <div className="consultations-title-wrap">
              <h1>Consultations</h1>
              <p>Manage consultations and provide recommendations</p>
            </div>

            <div className="consultations-header-actions">
              <button type="button" className="bell-btn" title="Notifications">
                🔔
              </button>
              <button
                type="button"
                className="schedule-btn"
                onClick={() => {
                  if (upcomingConsultations.length > 0) {
                    setActiveSessionItem(upcomingConsultations[0]);
                  }
                }}
              >
                + Schedule Consultation
              </button>
            </div>
          </header>

          {/* 3 Top Stat Cards */}
          <div className="consult-stats-grid">
            <div className="consult-stat-card">
              <div className="label">Total Consultations</div>
              <div className="val">14</div>
            </div>
            <div className="consult-stat-card">
              <div className="label">Upcoming</div>
              <div className="val">4</div>
            </div>
            <div className="consult-stat-card">
              <div className="label">Completed</div>
              <div className="val">7</div>
            </div>
          </div>

          {/* Main Consultations Table Card */}
          <div className="consultations-panel-card">
            {/* Tabs */}
            <div className="consult-tabs-row">
              <button
                type="button"
                className={`consult-tab-btn ${consultTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setConsultTab('upcoming')}
              >
                Upcoming ({upcomingConsultations.length})
              </button>
              <button
                type="button"
                className={`consult-tab-btn ${consultTab === 'completed' ? 'active' : ''}`}
                onClick={() => setConsultTab('completed')}
              >
                Completed ({completedConsultations.length})
              </button>
            </div>

            {/* Items List */}
            <div className="consultation-items-list">
              {(consultTab === 'upcoming' ? upcomingConsultations : completedConsultations).map((item) => (
                <div key={item.id} className="consult-item-row">
                  <div className="consult-item-main">
                    <div className="consult-item-left">
                      <div className="consult-avatar">{item.avatarInitials}</div>
                      <div className="consult-info">
                        <div className="consult-patient-name">{item.patientName}</div>
                        <div className="consult-student-id">{item.studentId}</div>
                        <div className="consult-time-str">{item.scheduledTime}</div>
                      </div>
                    </div>

                    <div className="consult-item-right">
                      {item.status === 'Completed' ? (
                        <>
                          <span className="status-pill-green">Completed</span>
                          <button
                            type="button"
                            className="view-case-btn"
                            onClick={() => setActiveSessionItem(item)}
                          >
                            View Case
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="status-pill-blue">Scheduled</span>
                          <button
                            type="button"
                            className="start-session-btn"
                            onClick={() => setActiveSessionItem(item)}
                          >
                            Start Session
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {item.notes ? (
                    <div className="consult-notes-box">
                      <strong>Notes:</strong> {item.notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
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
          </section>
        </main>
      )}

      {/* LIVE DOCTOR CONSULTATION & TWO-WAY CHAT MODAL */}
      {activeSessionItem && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box">
            <div className="web-chat-modal-header">
              <div>
                <h3>Consultation Session: {activeSessionItem.patientName}</h3>
                <p>{activeSessionItem.studentId} · {activeSessionItem.scheduledTime}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                  onClick={() => setShowVideoCall(true)}
                >
                  📹 Start Video Call
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
                  onClick={() => {
                    setActiveSessionItem(null);
                    setShowVideoCall(false);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {showVideoCall ? (
              <div style={{ flex: 1, padding: '10px' }}>
                <DoctorVideoCallPanel />
              </div>
            ) : (
              <>
                <div className="web-chat-body">
                  {webChatMessages.map((msg) => (
                    <div key={msg.id} className={`web-msg-row ${msg.sender}`}>
                      <div className={`web-msg-bubble ${msg.sender}`}>
                        <div>{msg.text}</div>
                        <div className="web-msg-time">{msg.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <form className="web-chat-input-bar" onSubmit={handleSendWebMessage}>
                  <input
                    type="text"
                    placeholder={`Reply to ${activeSessionItem.patientName}...`}
                    value={webInputMessage}
                    onChange={(e) => setWebInputMessage(e.target.value)}
                  />
                  <button type="submit">Send</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WebAuth({
  screen,
  setScreen,
}: {
  screen: 'login' | 'register' | 'forgot' | 'reset';
  setScreen: (screen: 'login' | 'register' | 'forgot' | 'reset' | 'roles') => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Create your account</h1>
          <p>Start a calmer, more connected care experience.</p>
          <form className="auth-form" onSubmit={handleRegister}>
            <input placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {errorMessage && <p className="auth-error">{errorMessage}</p>}
            <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create account'}</button>
          </form>
          <p className="auth-switch">Already have an account? <button type="button" onClick={() => setScreen('login')}>Sign in</button></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Sign in to continue to your MindPulse workspace.</p>
        <form className="auth-form" onSubmit={handleLogin}>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {errorMessage && <p className="auth-error">{errorMessage}</p>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">New to MindPulse? <button type="button" onClick={() => setScreen('register')}>Create account</button></p>
      </div>
    </div>
  );
}

function RoleSelection({ setScreen }: { setScreen: (screen: 'doctor' | 'admin' | 'login') => void }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Choose your workspace</h1>
        <p>Select the portal that matches your role.</p>
        <div className="role-grid">
          <button type="button" className="role-card" onClick={() => setScreen('doctor')}>
            <strong>Doctor Dashboard</strong>
            <span>Review patients, schedules, and consultations.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState<'doctor' | 'roles' | 'login' | 'register'>('doctor');
  const signOut = () => setScreen('login');

  if (screen === 'doctor') return <DoctorDashboard onSignOut={signOut} />;
  if (screen === 'roles') return <RoleSelection setScreen={(s) => setScreen(s === 'doctor' ? 'doctor' : 'login')} />;
  return <WebAuth screen={screen === 'register' ? 'register' : 'login'} setScreen={(s) => setScreen(s as any)} />;
}

export default App;