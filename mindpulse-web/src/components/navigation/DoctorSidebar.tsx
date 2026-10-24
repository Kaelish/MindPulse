import React, { useEffect, useState } from 'react';
import { fetchDoctorProfile } from '../../services/doctorProfile';
import { BrandLogo } from '../BrandLogo';
import '../../views/doctor/doctor-theme.css';

export type DoctorView =
  | 'dashboard'
  | 'student-cases'
  | 'student-case-detail'
  | 'assessment-results'
  | 'consultations'
  | 'transactions'
  | 'recommendations'
  | 'help'
  | 'profile-setting'
  | 'settings';

interface DoctorSidebarProps {
  activeView: DoctorView;
  setActiveView: (view: DoctorView) => void;
  onSignOut: () => void;
}

interface SidebarIdentity {
  name: string;
  email: string;
  role: string;
  initials: string;
  avatarUrl: string | null;
}

const initialsOf = (first: string, last: string): string => {
  const mark = `${first.charAt(0)}${last.charAt(0)}`.trim();
  return (mark || first.charAt(0) || 'D').toUpperCase();
};

const withPeriod = (initial: string): string => {
  const trimmed = initial.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
};

const displayNameOf = (title: string, first: string, middleInitial: string, last: string): string => {
  const full = [first, withPeriod(middleInitial), last].filter(Boolean).join(' ');
  return full ? [title.trim(), full].filter(Boolean).join(' ') : 'Doctor';
};

export const DoctorSidebar: React.FC<DoctorSidebarProps> = ({
  activeView,
  setActiveView,
  onSignOut,
}) => {
  const [identity, setIdentity] = useState<SidebarIdentity>({
    name: 'Doctor',
    email: '',
    role: 'Psychologist',
    initials: 'D',
    avatarUrl: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchDoctorProfile()
      .then((profile) => {
        if (cancelled) return;
        const first = profile.firstName.trim();
        const last = profile.lastName.trim();
        setIdentity({
          name: displayNameOf(profile.title, first, profile.middleInitial, last),
          email: profile.email.trim(),
          role: profile.specialty.trim() || profile.department.trim() || 'Psychologist',
          initials: initialsOf(first, last),
          avatarUrl: profile.avatarUrl,
        });
      })
      .catch(() => {
        // Signed out, offline, or Supabase not configured — keep the fallback.
      });
    const updateAvatar = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarUrl: string | null }>).detail;
      setIdentity((current) => ({ ...current, avatarUrl: detail?.avatarUrl ?? null }));
    };
    const updateProfile = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; email?: string; title?: string; specialty?: string }>).detail;
      setIdentity((current) => {
        const name = detail?.name !== undefined
          ? [detail.title?.trim(), detail.name].filter(Boolean).join(' ') || current.name
          : current.name;
        return {
          ...current,
          name,
          email: detail?.email ?? current.email,
          role: detail?.specialty ?? current.role,
        };
      });
    };
    window.addEventListener('mindpulse:avatar-updated', updateAvatar);
    window.addEventListener('mindpulse:profile-updated', updateProfile);
    return () => {
      cancelled = true;
      window.removeEventListener('mindpulse:avatar-updated', updateAvatar);
      window.removeEventListener('mindpulse:profile-updated', updateProfile);
    };
  }, []);

  const navItems: { key: DoctorView; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '\u2302' },
    { key: 'student-cases', label: 'Patient Cases', icon: '\u25C9' },
    { key: 'assessment-results', label: 'Assessment Results', icon: '\u25A3' },
    { key: 'consultations', label: 'Consultations', icon: '\u25A4' },
    { key: 'transactions', label: 'Transactions', icon: '\u25C8' },
    { key: 'recommendations', label: 'Suggestions', icon: '\u25CE' },
    { key: 'help', label: 'Help & Guide', icon: '\u24D8' },
    { key: 'settings', label: 'Settings', icon: '\u2699' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark has-image"><BrandLogo className="brand-logo-img" /></div>
        <div>
          <div className="brand-name">MindPulse</div>
          <div className="brand-subtitle">Doctor Portal</div>
        </div>
      </div>

      <nav className="nav-panel" aria-label="Main sidebar navigation">
        <span className="nav-label">Menu</span>
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${activeView === item.key ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveView(item.key)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-text">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-account-area">
        <button
          type="button"
          className={`sidebar-profile-card ${activeView === 'profile-setting' ? 'is-active' : ''}`}
          onClick={() => setActiveView('profile-setting')}
        >
          <div className="sidebar-profile-top">
            <div className="sidebar-doctor-avatar">
              {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" /> : identity.initials}
            </div>
            <div className="sidebar-doctor-info">
              <div className="sidebar-doctor-name">{identity.name}</div>
              {identity.email && <div className="sidebar-doctor-email">{identity.email}</div>}
              <div className="sidebar-doctor-spec">{identity.role}</div>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="sidebar-signout-btn"
          onClick={onSignOut}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};
