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
  { id: 'a6a45e6c-63b3-44e6-895b-98d5dd7', name: 'John Doe', age: 24, condition: 'Stress recovery', lastVisit: 'Today, 3:30 PM', score: 68, status: 'Watch' },
];

const appointments: AppointmentItem[] = [
  { id: 'A-201', time: '3:30 PM', patient: 'John Doe', type: 'Video Call', doctor: 'Dr. Monroe Leclair', status: 'Confirmed' },
];

function DoctorDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  type DoctorView = 'dashboard' | 'student-cases' | 'assessment-results' | 'consultations' | 'recommendations';
  const [activeView, setActiveView] = useState<DoctorView>('consultations');

  // Consultations & Live Messaging State
  const [consultations, setConsultations] = useState<WebConsultationItem[]>([]);
  const [consultTab, setConsultTab] = useState<'upcoming' | 'completed' | 'messages'>('upcoming');
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

  // Real-time polling for Supabase chat messages when live chat or messages tab is open
  useEffect(() => {
    let isSubscribed = true;

    const loadMessages = async () => {
      const msgs = await fetchWebChatMessages('1b64dd8f-48f1-4298-ac06-61377665e');
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
  }, [activeSessionItem, consultTab]);

  const handleSendWebMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!webInputMessage.trim()) return;

    const text = webInputMessage.trim();
    setWebInputMessage('');

    const newMsg = await sendWebChatMessage('1b64dd8f-48f1-4298-ac06-61377665e', 'doctor', text);
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
      {/* Sidebar matching database information: Dr. Monroe Leclair */}
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

        {/* Doctor Monroe Leclair Profile Footer Card */}
        <div className="sidebar-profile-card">
          <div className="sidebar-profile-top">
            <div className="sidebar-doctor-avatar">👩‍⚕️</div>
            <div className="sidebar-doctor-info">
              <div className="sidebar-doctor-name">Dr. Monroe Leclair</div>
              <div className="sidebar-doctor-email">doctor.test@mindpulse.org</div>
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
        /* CONSULTATIONS SCREEN CONNECTED TO BACKEND SUPABASE & MOBILE PATIENT */
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
                onClick={() => setConsultTab('messages')}
              >
                💬 Open Messages
              </button>
            </div>
          </header>

          {/* 3 Top Stat Cards */}
          <div className="consult-stats-grid">
            <div className="consult-stat-card">
              <div className="label">Total Consultations</div>
              <div className="val">{consultations.length}</div>
            </div>
            <div className="consult-stat-card">
              <div className="label">Upcoming</div>
              <div className="val">{upcomingConsultations.length}</div>
            </div>
            <div className="consult-stat-card">
              <div className="label">Completed</div>
              <div className="val">{completedConsultations.length}</div>
            </div>
          </div>

          {/* Main Consultations Table Panel */}
          <div className="consultations-panel-card">
            {/* Tabs inside Consultation Panel */}
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
              <button
                type="button"
                className={`consult-tab-btn ${consultTab === 'messages' ? 'active' : ''}`}
                onClick={() => setConsultTab('messages')}
              >
                Messages 💬
              </button>
            </div>

            {/* TAB CONTENT */}
            {consultTab === 'messages' ? (
              /* DEDICATED MESSAGES TAB INSIDE CONSULTATIONS PANEL */
              <div style={{ display: 'flex', flexDirection: 'column', height: '420px', background: '#faf8ed', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>JD</div>
                    <div>
                      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>John Doe (teststudent)</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>student.test@mindpulse.edu · STU-001</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => {
                      if (upcomingConsultations.length > 0) setActiveSessionItem(upcomingConsultations[0]);
                      setShowVideoCall(true);
                    }}
                  >
                    📹 Launch Video Call
                  </button>
                </div>

                {/* Messages Thread Body */}
                <div className="web-chat-body" style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                  {webChatMessages.map((msg) => (
                    <div key={msg.id} className={`web-msg-row ${msg.sender}`}>
                      <div className={`web-msg-bubble ${msg.sender}`}>
                        <div>{msg.text}</div>
                        <div className="web-msg-time">{msg.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input Bar */}
                <form className="web-chat-input-bar" onSubmit={handleSendWebMessage}>
                  <input
                    type="text"
                    placeholder="Type message to John Doe..."
                    value={webInputMessage}
                    onChange={(e) => setWebInputMessage(e.target.value)}
                  />
                  <button type="submit">Send Message</button>
                </form>
              </div>
            ) : (
              /* UPCOMING AND COMPLETED LIST */
              <div className="consultation-items-list">
                {(consultTab === 'upcoming' ? upcomingConsultations : completedConsultations).map((item) => (
                  <div key={item.id} className="consult-item-row">
                    <div className="consult-item-main">
                      <div className="consult-item-left">
                        <div className="consult-avatar">{item.avatarInitials}</div>
                        <div className="consult-info">
                          <div className="consult-patient-name">{item.patientName}</div>
                          <div className="consult-student-id">{item.studentId} · {item.patientEmail}</div>
                          <div className="consult-time-str">{item.scheduledTime}</div>
                        </div>
                      </div>

                      <div className="consult-item-right">
                        {item.status === 'Completed' ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="status-pill-green">Completed</span>
                            <button
                              type="button"
                              className="view-case-btn"
                              onClick={() => setConsultTab('messages')}
                            >
                              💬 Message
                            </button>
                            <button
                              type="button"
                              className="view-case-btn"
                              onClick={() => setActiveSessionItem(item)}
                            >
                              View Case
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="status-pill-blue">Scheduled</span>
                            <button
                              type="button"
                              className="view-case-btn"
                              style={{ background: '#5b6ef5' }}
                              onClick={() => {
                                setActiveSessionItem(item);
                              }}
                            >
                              💬 Message Patient
                            </button>
                            <button
                              type="button"
                              className="start-session-btn"
                              onClick={() => {
                                setActiveSessionItem(item);
                                setShowVideoCall(true);
                              }}
                            >
                              Start Session
                            </button>
                          </div>
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
            )}
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
                <p>STU-001 · {activeSessionItem.scheduledTime}</p>
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