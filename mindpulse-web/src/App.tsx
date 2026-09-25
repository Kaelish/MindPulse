import { useEffect, useState } from 'react';
import { supabase } from './supabase/client';
import { getCurrentUserRole } from './services/session';
import { DoctorSidebar, DoctorView } from './components/navigation/DoctorSidebar';
import { DoctorDashboardView } from './views/doctor/DoctorDashboardView';
import { StudentCase, StudentCasesView } from './views/doctor/StudentCasesView';
import { StudentCaseDetailView } from './views/doctor/StudentCaseDetailView';
import { AssessmentResultsView } from './views/doctor/AssessmentResultsView';
import { ConsultationsView } from './views/doctor/ConsultationsView';
import { RecommendationsView } from './views/doctor/RecommendationsView';
import { DoctorProfileSettingView } from './views/doctor/DoctorProfileSettingView';
import { AdminDashboardView } from './views/admin/AdminDashboardView';
import { WebAuth, AuthScreen } from './views/auth/WebAuth';
import './App.css';

type Portal = 'doctor' | 'admin' | 'unauthorized';

function DoctorPortal({ onSignOut }: { onSignOut: () => void }) {
  const [activeView, setActiveView] = useState<DoctorView>('consultations');
  const [selectedStudent, setSelectedStudent] = useState<StudentCase | null>(null);

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DoctorDashboardView onSignOut={onSignOut} />;
      case 'student-cases':
        return <StudentCasesView onViewDetails={(student) => { setSelectedStudent(student); setActiveView('student-case-detail'); }} />;
      case 'student-case-detail':
        return selectedStudent ? <StudentCaseDetailView student={selectedStudent} onBack={() => setActiveView('student-cases')} /> : <StudentCasesView />;
      case 'assessment-results':
        return <AssessmentResultsView onViewFullCase={() => setActiveView('student-case-detail')} />;
      case 'consultations':
        return <ConsultationsView />;
      case 'recommendations':
        return <RecommendationsView />;
      case 'profile-setting':
        return <DoctorProfileSettingView />;
      default:
        return <ConsultationsView />;
    }
  };

  return (
    <div className="doctor-shell">
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
            <span className="brand-icon">M</span>
            <span>MindPulse</span>
          </div>
          <h2>No portal access</h2>
          <p>The web portals are available to clinic staff accounts.</p>
        </aside>
        <div className="auth-form-panel">
          <h1>This account cannot open the web portal</h1>
          <p>
            Your account does not have doctor or administrator access. Students use the
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

function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('register');
  const [portal, setPortal] = useState<Portal | null>(null);
  const [checkingSession, setCheckingSession] = useState(
    () => Boolean(supabase && typeof supabase.auth.getSession === 'function'),
  );

  const routeToPortal = async () => {
    const role = await getCurrentUserRole();
    setPortal(role === 'doctor' ? 'doctor' : role === 'admin' ? 'admin' : 'unauthorized');
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
            void routeToPortal();
          } else if (event === 'SIGNED_OUT') {
            setPortal(null);
            setAuthScreen('login');
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
    try {
      await supabase?.auth.signOut();
    } catch {
      // Network error: still drop the local portal state below.
    }
    setPortal(null);
    setAuthScreen('login');
  };

  if (portal === 'doctor') return <DoctorPortal onSignOut={signOut} />;
  if (portal === 'admin') return <AdminDashboardView onSignOut={signOut} />;
  if (portal === 'unauthorized') return <UnauthorizedView onSignOut={signOut} />;

  if (checkingSession) {
    return (
      <div className="auth-shell" style={{ justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontWeight: 700 }}>Checking session…</p>
      </div>
    );
  }

  return <WebAuth screen={authScreen} setScreen={setAuthScreen} />;
}

export default App;
