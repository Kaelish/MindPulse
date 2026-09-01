import { useState } from 'react';
import { DoctorSidebar, DoctorView } from './components/navigation/DoctorSidebar';
import { DoctorDashboardView } from './views/doctor/DoctorDashboardView';
import { StudentCasesView } from './views/doctor/StudentCasesView';
import { AssessmentResultsView } from './views/doctor/AssessmentResultsView';
import { ConsultationsView } from './views/doctor/ConsultationsView';
import { RecommendationsView } from './views/doctor/RecommendationsView';
import { AdminDashboardView } from './views/admin/AdminDashboardView';
import { WebAuth } from './views/auth/WebAuth';
import { RoleSelection } from './views/auth/RoleSelection';
import './App.css';

function DoctorPortal({ onSignOut }: { onSignOut: () => void }) {
  const [activeView, setActiveView] = useState<DoctorView>('consultations');

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DoctorDashboardView onSignOut={onSignOut} />;
      case 'student-cases':
        return <StudentCasesView />;
      case 'assessment-results':
        return <AssessmentResultsView />;
      case 'consultations':
        return <ConsultationsView />;
      case 'recommendations':
        return <RecommendationsView />;
      default:
        return <ConsultationsView />;
    }
  };

  return (
    <div className="doctor-shell">
      <DoctorSidebar
        activeView={activeView}
        setActiveView={setActiveView}
        onSignOut={onSignOut}
      />
      {renderActiveView()}
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState<'doctor' | 'admin' | 'roles' | 'login' | 'register' | 'forgot' | 'reset'>('register');
  const signOut = () => setScreen('login');

  if (screen === 'doctor') return <DoctorPortal onSignOut={signOut} />;
  if (screen === 'admin') return <AdminDashboardView onSignOut={signOut} />;
  if (screen === 'roles') {
    return <RoleSelection setScreen={(next) => setScreen(next === 'login' ? 'login' : next)} />;
  }

  return (
    <WebAuth
      screen={screen === 'forgot' || screen === 'reset' ? screen : screen === 'register' ? 'register' : 'login'}
      setScreen={(next) => setScreen(next === 'roles' ? 'roles' : next)}
    />
  );
}

export default App;