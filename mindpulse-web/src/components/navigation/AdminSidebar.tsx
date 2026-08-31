import React from 'react';

interface AdminSidebarProps {
  onSignOut: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onSignOut }) => {
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
        <button className="nav-item active" type="button">⌂ Dashboard</button>
        <button className="nav-item" type="button">👥 Users</button>
        <button className="nav-item" type="button">▣ Assessment tools</button>
        <button className="nav-item" type="button">▤ Results</button>
        <button className="nav-item" type="button">◌ Analytics</button>
      </nav>
      <div style={{ marginTop: 'auto', padding: '10px' }}>
        <button type="button" className="sidebar-signout-btn" onClick={onSignOut}>
          ➔ Sign Out
        </button>
      </div>
    </aside>
  );
};
