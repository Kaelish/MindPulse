import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase/client';
import { getCurrentUserRole, isAccountDeactivated } from './services/session';
import { reactivateOwnAccount } from './services/profile';
import { reportProfileSessionError, signOutCurrentDevice, startProfileSessionMonitor } from './services/profileSessions';
import { clearAdminIdentity } from './services/adminIdentity';
import { prepareSignInVerification, VerificationChallenge } from './services/signInVerification';
import { VerificationChallengeView, VerificationUnavailableView } from './views/auth/VerificationChallengeView';
import { applyAdminSettings, loadAdminSettings } from './services/adminSettings';
import { applyDoctorSettings, loadDoctorSettings } from './services/doctorSettings';
import { DoctorSidebar, DoctorView } from './components/navigation/DoctorSidebar';
import { BrandLogo } from './components/BrandLogo';
import { DOCTOR_NAVIGATE_EVENT, DoctorNavigateDetail } from './components/NotificationHistorySheet';
import { DoctorDashboardView } from './views/doctor/DoctorDashboardView';
import { StudentCase, StudentCasesView } from './views/doctor/StudentCasesView';
import { StudentCaseDetailView } from './views/doctor/StudentCaseDetailView';
import { AssessmentResultsView } from './views/doctor/AssessmentResultsView';
import { ConsultationsView, ConsultationsTabRequest } from './views/doctor/ConsultationsView';
import { TransactionsView } from './views/doctor/TransactionsView';
import { SuggestionsView } from './views/doctor/SuggestionsView';
import { DoctorProfileSettingView } from './views/doctor/DoctorProfileSettingView';
import { DoctorSettingsView } from './views/doctor/DoctorSettingsView';
import { HelpView } from './views/doctor/HelpView';
import { AdminDashboardView } from './views/admin/AdminDashboardView';
import { WebAuth, AuthScreen } from './views/auth/WebAuth';
import { EmailVerifiedView } from './views/auth/EmailVerifiedView';
import { LandingPage } from './views/landing/LandingPage';
import './App.css';

type Portal = 'doctor' | 'admin' | 'pending' | 'unauthorized';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function DoctorPortal({ onSignOut }: { onSignOut: () => void }) {
  const [activeView, setActiveView] = useState<DoctorView>(() => loadDoctorSettings().landingView);
  const [selectedStudent, setSelectedStudent] = useState<StudentCase | null>(null);
  const [consultTabReq, setConsultTabReq] = useState<ConsultationsTabRequest | null>(null);
  // Where the case-detail Back button returns to (Student Cases or Consultations).
  const [caseBackView, setCaseBackView] = useState<DoctorView>('student-cases');

  // A notification's "View details" jumps straight to the matching section.
  useEffect(() => {
    const handleNotificationJump = (event: Event) => {
      const detail = (event as CustomEvent<DoctorView | DoctorNavigateDetail>).detail;
      if (!detail) return;
      const view = typeof detail === 'string' ? detail : detail.view;
      const tab = typeof detail === 'string' ? undefined : detail.tab;
      setActiveView(view);
      if (view === 'consultations' && tab) {
        setConsultTabReq((current) => ({ tab, nonce: (current?.nonce ?? 0) + 1 }));
      }
    };
    window.addEventListener(DOCTOR_NAVIGATE_EVENT, handleNotificationJump);
    return () => window.removeEventListener(DOCTOR_NAVIGATE_EVENT, handleNotificationJump);
  }, []);

  // Consumed after ConsultationsView has applied it, so a later visit to the
  // section through the sidebar starts on the default tab again.
  useEffect(() => {
    if (consultTabReq) setConsultTabReq(null);
  }, [consultTabReq]);

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <DoctorDashboardView
            onViewCase={(student) => {
              setSelectedStudent(student);
              setCaseBackView('student-cases');
              setActiveView('student-case-detail');
            }}
            onViewAllCases={() => setActiveView('student-cases')}
          />
        );
      case 'student-cases':
        return <StudentCasesView onViewDetails={(student) => { setSelectedStudent(student); setCaseBackView('student-cases'); setActiveView('student-case-detail'); }} />;
      case 'student-case-detail':
        return selectedStudent ? <StudentCaseDetailView student={selectedStudent} onBack={() => setActiveView(caseBackView)} /> : <StudentCasesView />;
      case 'assessment-results':
        return <AssessmentResultsView onViewFullCase={() => setActiveView('student-case-detail')} />;
      case 'consultations':
        return (
          <ConsultationsView
            openTabRequest={consultTabReq}
            onViewHistory={(student) => {
              setSelectedStudent(student);
              setCaseBackView('consultations');
              setActiveView('student-case-detail');
            }}
          />
        );
      case 'transactions':
        return <TransactionsView />;
      case 'recommendations':
        return <SuggestionsView />;
      case 'help':
        return <HelpView onNavigate={setActiveView} />;
      case 'profile-setting':
        return <DoctorProfileSettingView />;
      case 'settings':
        return <DoctorSettingsView />;
      default:
        return <ConsultationsView openTabRequest={consultTabReq} />;
    }
  };

  return (
    <div className="doctor-shell doctor-scope">
      <DoctorSidebar
        activeView={activeView === 'student-case-detail' ? 'student-cases' : activeView}
        setActiveView={setActiveView}
        onSignOut={onSignOut}
      />
      {renderActiveView()}
    </div>
  );
}

function UnauthorizedView({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-split">
        <aside className="auth-side-panel auth-side-panel-soft">
          <div className="brand-chip">
            <span className="brand-icon has-image"><BrandLogo className="brand-logo-img" /></span>
            <span>MindPulse</span>
          </div>
          <h2>No portal access</h2>
          <p>The web portals are available to clinic staff accounts.</p>
        </aside>
        <div className="auth-form-panel">
          <h1>This account cannot open the web portal</h1>
          <p>
            Your account does not have doctor or administrator access. Patients use the
            MindPulse mobile app. Sign out and sign in with a staff account if you were
            expecting portal access.
          </p>
          <button className="primary-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shown instead of any portal when profiles.is_deactivated is true (0042).
 * The account was never removed from auth.users, so signing in succeeded —
 * the person is asked whether to bring the account back before anything loads.
 */
function DeactivatedAccountView({
  onReactivate,
  onSignOut,
}: {
  onReactivate: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await onReactivate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This account could not be reactivated.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-split">
        <aside className="auth-side-panel auth-side-panel-soft">
          <div className="brand-chip">
            <span className="brand-icon has-image"><BrandLogo className="brand-logo-img" /></span>
            <span>MindPulse</span>
          </div>
          <h2>Account deactivated</h2>
          <p>Your records are kept on file and are not visible while the account is deactivated.</p>
        </aside>
        <div className="auth-form-panel">
          <h1>This account was deactivated. Would you like to reactivate this account?</h1>
          <p>
            Choosing Reactivate restores access with everything as it was. Anything you
            deleted earlier stays in Recently Deleted until you restore it yourself.
          </p>
          <div className="auth-form">
            <button className="primary-button" type="button" onClick={() => void reactivate()} disabled={busy}>
              {busy ? 'Reactivating…' : 'Yes, reactivate this account'}
            </button>
            <button className="primary-button" type="button" onClick={onSignOut} disabled={busy}>
              No, sign out
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function PendingApprovalView({ onSignOut, onRecheck }: { onSignOut: () => void; onRecheck: () => Promise<Portal> }) {
  const [isChecking, setIsChecking] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const recheck = async () => {
    setIsChecking(true);
    setStatusNote(null);
    try {
      const next = await onRecheck();
      if (next === 'pending') {
        setStatusNote('Still awaiting approval — try again in a moment.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-split">
        <aside className="auth-side-panel auth-side-panel-soft">
          <div className="brand-chip">
            <span className="brand-icon has-image"><BrandLogo className="brand-logo-img" /></span>
            <span>MindPulse</span>
          </div>
          <h2>Awaiting approval</h2>
          <p>New doctor accounts are reviewed by the clinic administrator before the portal opens.</p>
        </aside>
        <div className="auth-form-panel">
          <h1>Your registration is pending</h1>
          <p>
            Your doctor account was created successfully. The administrator still needs to
            approve your registration — you will get full portal access as soon as that
            happens. If you were approved just now, continue below.
          </p>
          <div className="auth-form">
            <button className="primary-button" type="button" onClick={recheck} disabled={isChecking}>
              {isChecking ? 'Checking…' : 'Continue'}
            </button>
            <button className="primary-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
          {statusNote && <p role="status">{statusNote}</p>}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  // Public landing page is the first screen; Log In (or signing out) opens the
  // existing web login without touching the Admin/Doctor portal routing below.
  const [showLogin, setShowLogin] = useState(false);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [checkingSession, setCheckingSession] = useState(
    () => Boolean(supabase && typeof supabase.auth.getSession === 'function'),
  );
  const [verification, setVerification] = useState<VerificationChallenge | null>(null);
  const [verificationFailure, setVerificationFailure] = useState('');
  // True while the signed-in account is deactivated and the reactivation
  // prompt is on screen (0042). No portal may mount while this is set.
  const [deactivated, setDeactivated] = useState(false);
  const portalRef = useRef<Portal | null>(null);
  const routingRef = useRef<Promise<Portal> | null>(null);

  useEffect(() => {
    portalRef.current = portal;
  }, [portal]);

  const routeToPortal = async (): Promise<Portal> => {
    if (routingRef.current) return routingRef.current;
    const work = (async (): Promise<Portal> => {
      try {
        const challenge = await prepareSignInVerification();
        if (challenge) {
          setVerificationFailure('');
          setVerification(challenge);
          setPortal(null);
          return 'unauthorized';
        }
      } catch (cause) {
        setVerification(null);
        setVerificationFailure(cause instanceof Error ? cause.message : 'Sign-in verification could not be started.');
        setPortal(null);
        return 'unauthorized';
      }
      setVerification(null);
      setVerificationFailure('');
      const role = await getCurrentUserRole();
      // Deactivation gate (0042): a deactivated account never reaches a
      // portal. The prompt owns navigation from here until the person picks.
      if (await isAccountDeactivated()) {
        setDeactivated(true);
        setPortal(null);
        return 'unauthorized';
      }
      setDeactivated(false);
      const next: Portal =
        role === 'doctor' ? 'doctor'
        : role === 'admin' ? 'admin'
        : role === 'pending' ? 'pending'
        : 'unauthorized';
      setPortal(next);
      return next;
    })();
    routingRef.current = work;
    try {
      return await work;
    } finally {
      routingRef.current = null;
    }
  };

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }
    let cancelled = false;

    const getSession = supabase.auth.getSession;
    if (typeof getSession === 'function') {
      Promise.resolve(supabase.auth.getSession())
        .then(async ({ data }) => {
          if (cancelled) return;
          if (data.session) await routeToPortal();
          if (!cancelled) setCheckingSession(false);
        })
        .catch(() => {
          if (!cancelled) setCheckingSession(false);
        });
    }

    let unsubscribe: (() => void) | undefined;
    if (typeof supabase.auth.onAuthStateChange === 'function') {
      try {
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            // A password re-check inside Security also emits SIGNED_IN; do not
            // restart the portal or ask for a fresh verification in that case.
            if (!portalRef.current) void routeToPortal();
          } else if (event === 'SIGNED_OUT') {
            clearAdminIdentity();
            setPortal(null);
            setVerification(null);
            setVerificationFailure('');
            setAuthScreen('login');
            setShowLogin(true);
          }
        });
        unsubscribe = listener.subscription.unsubscribe;
      } catch {
        // Listener is optional; routing still works through getSession.
      }
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    // Local/this-device only: other signed-in devices stay connected and keep
    // appearing in Active Login Sessions.
    await signOutCurrentDevice();
    clearAdminIdentity();
    setPortal(null);
    setVerification(null);
    setVerificationFailure('');
    setDeactivated(false);
    setAuthScreen('login');
    setShowLogin(true);
  };

  // Track this tab for as long as a staff portal is open. This is what makes
  // the laptop/desktop session appear in Active Login Sessions even when the
  // user never opens Profile → Security.
  useEffect(() => {
    if (!portal) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    const label = portal === 'admin' ? 'Admin web' : portal === 'doctor' ? 'Doctor web' : 'MindPulse web';
    startProfileSessionMonitor(label)
      .then((disconnect) => {
        if (cancelled) disconnect();
        else stop = disconnect;
      })
      .catch((cause: unknown) => {
        // The monitor normally reports its own failures; this is the last line
        // of defence so the panel never silently stays on "Connecting".
        reportProfileSessionError(cause);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [portal]);

  // Apply saved Settings (theme, density, document title) as soon as the app boots.
  // The doctor appearance is scoped to `.doctor-scope`, so applying it here never
  // changes the admin portal or the auth screens.
  useEffect(() => {
    applyAdminSettings(loadAdminSettings());
    applyDoctorSettings(loadDoctorSettings());
  }, []);

  // The tab/window title follows the portal. The admin System Name setting only
  // belongs on the admin portal — otherwise a doctor's tab reads "Admin Portal".
  useEffect(() => {
    document.title =
      portal === 'admin' ? loadAdminSettings().general.systemName
      : portal === 'doctor' ? 'MindPulse Doctor Portal'
      : 'MindPulse';
  }, [portal]);

  // Security → Session Timeout: auto sign-out after 30 minutes of inactivity.
  useEffect(() => {
    if (portal !== 'admin' || !loadAdminSettings().security.sessionTimeout) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void signOut();
      }, SESSION_TIMEOUT_MS);
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);

  if (verificationFailure) {
    return (
      <VerificationUnavailableView
        message={verificationFailure}
        onRetry={() => void routeToPortal()}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (verification) {
    return (
      <VerificationChallengeView
        challenge={verification}
        onVerified={() => {
          setVerification(null);
          void routeToPortal();
        }}
        onSignOut={() => void signOut()}
      />
    );
  }

  // Deactivation gate (0042): takes precedence over every portal so a
  // deactivated account can never mount a dashboard.
  if (deactivated) {
    return (
      <DeactivatedAccountView
        onReactivate={async () => {
          await reactivateOwnAccount();
          setDeactivated(false);
          await routeToPortal();
        }}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (portal === 'doctor') return <DoctorPortal onSignOut={signOut} />;
  if (portal === 'admin') return <AdminDashboardView onSignOut={signOut} />;
  if (portal === 'pending') return <PendingApprovalView onSignOut={signOut} onRecheck={routeToPortal} />;
  if (portal === 'unauthorized') return <UnauthorizedView onSignOut={signOut} />;

  if (checkingSession) {
    return (
      <div className="auth-shell" style={{ justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontWeight: 700 }}>Checking session…</p>
      </div>
    );
  }

  if (!showLogin) {
    return <LandingPage onLogIn={() => setShowLogin(true)} />;
  }

  return (
    <WebAuth
      screen={authScreen}
      setScreen={setAuthScreen}
      onBackToLanding={() => setShowLogin(false)}
    />
  );
}

function AppEntry() {
  if (window.location.pathname === '/email-verified') {
    return <EmailVerifiedView />;
  }
  return <App />;
}

export default AppEntry;
