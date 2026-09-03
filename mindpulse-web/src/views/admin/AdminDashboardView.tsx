import React, { useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminUsersView } from './AdminUsersView';
import { AdminResultsView } from './AdminResultsView';

interface AdminDashboardViewProps {
  onSignOut: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onSignOut }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'users' | 'results' | 'analytics'>('dashboard');

  if (activeView === 'analytics') {
    return <AdminAnalyticsView onSignOut={onSignOut} onNavigate={setActiveView} />;
  }
  if (activeView === 'users') return <AdminUsersView onSignOut={onSignOut} onNavigate={setActiveView} />;
  if (activeView === 'results') return <AdminResultsView onSignOut={onSignOut} onNavigate={setActiveView} />;

  return (
    <div className="doctor-shell">
      <AdminSidebar onSignOut={onSignOut} activeView={activeView} onNavigate={setActiveView} />

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
