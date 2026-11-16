import React, { useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { ADMIN_TRASH_CATEGORIES, RecentlyDeletedPanel } from '../../components/RecentlyDeletedPanel';
import './AdminTrashView.css';

interface AdminTrashViewProps {
  onSignOut: () => void;
  onNavigate?: (view: AdminNavView) => void;
}

export const AdminTrashView: React.FC<AdminTrashViewProps> = ({ onSignOut, onNavigate }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="settings" onNavigate={onNavigate} />
      <main className="main-panel admin-trash-main">
        <header className="topbar admin-trash-topbar">
          <div>
            <div className="eyebrow">System Management</div>
            <h1>Recently Deleted</h1>
            <p className="page-subtitle">
              Nothing here has been erased. Restore a record to make it visible in its normal list again.
            </p>
          </div>
          <div className="account-actions">
            <button
              type="button"
              className="notification-button"
              aria-label="View notifications"
              onClick={() => setShowNotifications((open) => !open)}
            >
              <NotificationBell />
            </button>
            {showNotifications && <NotificationPanel />}
          </div>
        </header>

        <RecentlyDeletedPanel categories={ADMIN_TRASH_CATEGORIES} />
      </main>
    </div>
  );
};
