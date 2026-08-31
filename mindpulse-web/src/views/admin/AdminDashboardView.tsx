import React from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';

interface AdminDashboardViewProps {
  onSignOut: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onSignOut }) => {
  return (
    <div className="doctor-shell">
      <AdminSidebar onSignOut={onSignOut} />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">System Management</div>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="ghost-button" onClick={onSignOut}>Sign out</button>
            <button type="button" className="primary-button">+ Manage Users</button>
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card tone-blue">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">2</div>
            <div className="stat-change">Doctor Monroe & John Doe</div>
          </article>
          <article className="stat-card tone-green">
            <div className="stat-label">Database Status</div>
            <div className="stat-value">Active</div>
            <div className="stat-change">Supabase Connected</div>
          </article>
        </section>
      </main>
    </div>
  );
};
