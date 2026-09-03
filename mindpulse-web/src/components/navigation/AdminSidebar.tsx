import React from 'react';
import './AdminSidebar.css';

interface AdminSidebarProps {
  onSignOut: () => void;
  activeView?: 'dashboard' | 'analytics';
  onNavigate?: (view: 'dashboard' | 'analytics') => void;
}

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
        <button className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => onNavigate?.('dashboard')}>⌂ Dashboard</button>
        <button className="nav-item" type="button">👥 Users</button>
        <button className="nav-item" type="button">▣ Assessment tools</button>
        <button className="nav-item" type="button">▤ Results</button>
        <button className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`} type="button" onClick={() => onNavigate?.('analytics')}>◌ Analytics</button>
        <button className="nav-item" type="button">⚙ Settings</button>
      </nav>
      <div className="admin-account-area">
        <div className="admin-account">
          <span className="admin-account-avatar">●</span>
          <span><strong>Admin User</strong><small>admin@mindpulse.com</small></span>
        </div>
        <button type="button" className="sidebar-signout-btn" onClick={onSignOut}>
          ➔ Sign Out
        </button>
      </div>
    </aside>
  );
};
