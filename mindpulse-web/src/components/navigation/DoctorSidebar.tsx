import React from 'react';

export type DoctorView =
  | 'dashboard'
  | 'student-cases'
  | 'assessment-results'
  | 'consultations'
  | 'recommendations';

interface DoctorSidebarProps {
  activeView: DoctorView;
  setActiveView: (view: DoctorView) => void;
  onSignOut: () => void;
}

export const DoctorSidebar: React.FC<DoctorSidebarProps> = ({
  activeView,
  setActiveView,
  onSignOut,
}) => {
  const navItems: { key: DoctorView; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
    { key: 'student-cases', label: 'Student Cases', icon: '👥' },
    { key: 'assessment-results', label: 'Assessment Results', icon: '▣' },
    { key: 'consultations', label: 'Consultations', icon: '📅' },
    { key: 'recommendations', label: 'Recommendations', icon: '📈' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">M</div>
        <div>
          <div className="brand-name">MindPulse</div>
          <div className="brand-subtitle">Doctor Portal</div>
        </div>
      </div>

      <nav className="nav-panel" aria-label="Main sidebar navigation">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${activeView === item.key ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveView(item.key)}
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
  );
};
