import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import {
  AdminIdentity,
  AVATAR_STORAGE_KEY,
  EMPTY_ADMIN_IDENTITY,
  loadAdminIdentity,
  patchCachedAdminIdentity,
  readCachedAdminIdentity,
} from '../../services/adminIdentity';
import { BrandLogo } from '../BrandLogo';
import './AdminSidebar.css';
import '../../views/admin/admin-theme.css';

/**
 * Every destination the admin portal can navigate to — one union shared by
 * the sidebar, the views' `onNavigate` props and AdminDashboardView's router,
 * so a new module can never be reachable from one of them and missing from
 * the others.
 */
export type AdminNavView =
  | 'dashboard'
  | 'users'
  | 'assessment'
  | 'results'
  | 'records'
  | 'suggestions'
  | 'analytics'
  | 'settings'
  | 'profile'
  | 'reports'
  | 'notifications'
  | 'consents'
  | 'activity';

interface AdminSidebarProps {
  onSignOut: () => void;
  activeView?: AdminNavView;
  onNavigate?: (view: AdminNavView) => void;
}

interface NavEntry {
  key: AdminNavView;
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
  { key: 'consents', icon: '⚖', label: 'Consent Register' },
  { key: 'activity', icon: '≡', label: 'Activity Log' },
  { key: 'settings', icon: '⚙', label: 'Settings' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onSignOut, activeView = 'dashboard', onNavigate }) => {
  // Start from the cached identity so a module switch never repaints the
  // placeholder card ("Administrator / No email on file") before the profile
  // request finishes. The cache is refreshed in the background below.
  const [identity, setIdentity] = useState<AdminIdentity>(() => {
    const cached = readCachedAdminIdentity();
    if (cached) return cached;
    let avatarUrl: string | null = null;
    try {
      avatarUrl = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    } catch {
      avatarUrl = null;
    }
    return { ...EMPTY_ADMIN_IDENTITY, avatarUrl };
  });

  useEffect(() => {
    let active = true;
    loadAdminIdentity()
      .then((next) => {
        if (!active) return;
        setIdentity(next);
        if (next.avatarUrl) {
          try {
            window.localStorage.setItem(AVATAR_STORAGE_KEY, next.avatarUrl);
          } catch {
            // Ignore storage failures.
          }
        }
      })
      .catch(() => {
        // Profile row missing: fall back to the auth account so the card is never stale.
        void supabase?.auth.getUser().then(({ data }) => {
          if (!active || !data.user) return;
          const patch: Partial<AdminIdentity> = { email: data.user.email ?? '' };
          const metadataName = `${data.user.user_metadata?.first_name ?? ''} ${data.user.user_metadata?.last_name ?? ''}`.trim();
          if (metadataName) patch.name = metadataName;
          setIdentity((current) => ({ ...current, ...patch }));
          patchCachedAdminIdentity(patch);
        });
      });
    const updateAvatar = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarUrl: string | null }>).detail;
      const avatarUrl = detail?.avatarUrl ?? null;
      setIdentity((current) => ({ ...current, avatarUrl }));
      patchCachedAdminIdentity({ avatarUrl });
    };
    const updateProfile = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; email?: string; preferredTitle?: string; administrativeTitle?: string }>).detail;
      const patch: Partial<AdminIdentity> = {};
      if (detail?.name !== undefined) patch.name = detail.name;
      if (detail?.email !== undefined) patch.email = detail.email;
      if (detail?.preferredTitle !== undefined) patch.preferredTitle = detail.preferredTitle;
      if (detail?.administrativeTitle !== undefined) patch.administrativeTitle = detail.administrativeTitle;
      if (Object.keys(patch).length === 0) return;
      setIdentity((current) => ({ ...current, ...patch }));
      patchCachedAdminIdentity(patch);
    };
    window.addEventListener('mindpulse:avatar-updated', updateAvatar);
    window.addEventListener('mindpulse:profile-updated', updateProfile);
    return () => {
      active = false;
      window.removeEventListener('mindpulse:avatar-updated', updateAvatar);
      window.removeEventListener('mindpulse:profile-updated', updateProfile);
    };
  }, []);

  const displayName = [identity.preferredTitle, identity.name || 'Administrator'].filter(Boolean).join(' ');
  const displayEmail = identity.email;
  const displayTitle = identity.administrativeTitle || 'Chief Clinical Administrator';

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
            {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" /> : 'A'}
          </span>
          <span className="admin-account-copy">
            <strong>{displayName}</strong>
            {displayEmail && <small>{displayEmail}</small>}
            <small className="admin-account-title">{displayTitle}</small>
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
