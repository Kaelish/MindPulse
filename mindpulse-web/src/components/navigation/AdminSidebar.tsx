import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import { fetchOwnProfile } from '../../services/profile';
import { BrandLogo } from '../BrandLogo';
import './AdminSidebar.css';
import '../../views/admin/admin-theme.css';

interface AdminSidebarProps {
  onSignOut: () => void;
  activeView?: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'suggestions' | 'analytics' | 'profile' | 'settings' | 'notifications';
  onNavigate?: (view: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'suggestions' | 'analytics' | 'profile' | 'settings') => void;
}

interface NavEntry {
  key: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'suggestions' | 'analytics' | 'settings';
  icon: string;
  label: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { key: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { key: 'users', icon: '◉', label: 'Users' },
  { key: 'assessment', icon: '▣', label: 'Assessment tools' },
  { key: 'results', icon: '▤', label: 'Results' },
  { key: 'records', icon: '▥', label: 'Records' },
  { key: 'suggestions', icon: '✦', label: 'Doctor Suggestions' },
  { key: 'analytics', icon: '◌', label: 'Analytics' },
  { key: 'settings', icon: '⚙', label: 'Settings' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onSignOut, activeView = 'dashboard', onNavigate }) => {
  const [avatarUrl, setAvatarUrl] = useState(() => window.localStorage.getItem('mindpulse.profileAvatarUrl'));
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileTitle, setProfileTitle] = useState('Chief Clinical Administrator');

  useEffect(() => {
    let active = true;
    fetchOwnProfile().then((profile) => {
      if (!active) return;
      setAvatarUrl(profile.avatar_url);
      if (profile.avatar_url) window.localStorage.setItem('mindpulse.profileAvatarUrl', profile.avatar_url);
      const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
      setProfileName(name);
      setProfileEmail(profile.email ?? '');
      setProfileTitle(profile.department || 'Chief Clinical Administrator');
    }).catch(() => {
      // Profile row missing: fall back to the auth account so the card is never stale.
      void supabase?.auth.getUser().then(({ data }) => {
        if (!active || !data.user) return;
        setProfileEmail(data.user.email ?? '');
        const metadataName = `${data.user.user_metadata?.first_name ?? ''} ${data.user.user_metadata?.last_name ?? ''}`.trim();
        setProfileName(metadataName);
      });
    });
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

  const displayName = profileName || 'Administrator';
  const displayEmail = profileEmail || 'No email on file';

  return (
    <aside className="admin-sidebar">
      <div className="brand-block">
        <div className="brand-mark has-image"><BrandLogo className="brand-logo-img" /></div>
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
        <button
          className={`admin-account ${activeView === 'profile' ? 'active' : ''}`}
          type="button"
          aria-label={`Open Profile Settings for ${displayName}`}
          aria-current={activeView === 'profile' ? 'page' : undefined}
          onClick={() => onNavigate?.('profile')}
        >
          <span className="admin-account-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : 'A'}
          </span>
          <span className="admin-account-copy">
            <strong>{displayName}</strong>
            <small>{displayEmail}</small>
            <small className="admin-account-title">{profileTitle}</small>
          </span>
        </button>
        <button type="button" className="sidebar-signout-btn" onClick={onSignOut}>
          <span className="signout-icon" aria-hidden="true">➔</span>
          <span className="signout-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
