import React from 'react';
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
          <span className="admin-account-avatar">A</span>
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
