import React, { useEffect, useState } from 'react';
import { fetchOwnProfile } from '../../services/profile';
import './AdminSidebar.css';
import '../../views/admin/admin-theme.css';

interface AdminSidebarProps {
  onSignOut: () => void;
  activeView?: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'analytics' | 'profile' | 'settings' | 'notifications';
  onNavigate?: (view: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'analytics' | 'profile' | 'settings') => void;
}

interface NavEntry {
  key: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'analytics' | 'settings';
  icon: string;
  label: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { key: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { key: 'users', icon: '◉', label: 'Users' },
  { key: 'assessment', icon: '▣', label: 'Assessment tools' },
  { key: 'results', icon: '▤', label: 'Results' },
  { key: 'records', icon: '▥', label: 'Records' },
  { key: 'analytics', icon: '◌', label: 'Analytics' },
  { key: 'settings', icon: '⚙', label: 'Settings' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onSignOut, activeView = 'dashboard', onNavigate }) => {
  const [avatarUrl, setAvatarUrl] = useState(() => window.localStorage.getItem('mindpulse.profileAvatarUrl'));

  useEffect(() => {
    let active = true;
    fetchOwnProfile().then((profile) => {
      if (active) {
        setAvatarUrl(profile.avatar_url);
        if (profile.avatar_url) window.localStorage.setItem('mindpulse.profileAvatarUrl', profile.avatar_url);
      }
    }).catch(() => {});
    const updateAvatar = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarUrl: string | null }>).detail;
      setAvatarUrl(detail?.avatarUrl ?? null);
    };
    window.addEventListener('mindpulse:avatar-updated', updateAvatar);
    return () => {
      active = false;
      window.removeEventListener('mindpulse:avatar-updated', updateAvatar);
    };
  }, []);

  return (
    <aside className="admin-sidebar">
      <div className="brand-block">
        <div className="brand-mark">M</div>
        <div>
          <div className="brand-name">MindPulse</div>
          <div className="brand-subtitle">Admin Portal</div>
        </div>
      </div>
      <nav className="nav-panel">
        <span className="nav-label">Menu</span>
        {NAV_ENTRIES.map((entry) => (
          <button
            key={entry.key}
            className={`nav-item ${activeView === entry.key ? 'active' : ''}`}
            type="button"
            onClick={() => onNavigate?.(entry.key)}
          >
            <span className="nav-icon" aria-hidden="true">{entry.icon}</span>
            <span className="nav-text">{entry.label}</span>
          </button>
        ))}
      </nav>
      <div className="admin-account-area">
        <div
          className={`admin-account ${activeView === 'profile' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onNavigate?.('profile')}
        >
          <span className="admin-account-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : 'A'}
          </span>
          <span>
            <strong>Admin User</strong>
            <small>admin@mindpulse.com</small>
          </span>
        </div>
        <button type="button" className="sidebar-signout-btn" onClick={onSignOut}>
          <span className="signout-icon" aria-hidden="true">➔</span>
          <span className="signout-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
