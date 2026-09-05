import React, { useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminUsersView } from './AdminUsersView';
import { AdminResultsView } from './AdminResultsView';
import { AdminProfileSettingsView } from './AdminProfileSettingsView';
import { NotificationBell } from '../../components/NotificationBell';
import './AdminDashboardView.css';

interface AdminDashboardViewProps {
  onSignOut: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onSignOut }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'users' | 'results' | 'analytics' | 'profile'>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);

  if (activeView === 'analytics') {
    return <AdminAnalyticsView onSignOut={onSignOut} onNavigate={setActiveView} />;
  }
  if (activeView === 'users') return <AdminUsersView onSignOut={onSignOut} onNavigate={setActiveView} />;
  if (activeView === 'results') return <AdminResultsView onSignOut={onSignOut} onNavigate={setActiveView} />;
  if (activeView === 'profile') return <AdminProfileSettingsView onSignOut={onSignOut} onNavigate={setActiveView} />;

  return (
    <div className="doctor-shell">
      <AdminSidebar onSignOut={onSignOut} activeView={activeView} onNavigate={setActiveView} />

      <main className="admin-dashboard-main">
        <header className="admin-dashboard-header">
          <div>
            <div className="admin-dashboard-eyebrow">System Management</div>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="admin-dashboard-actions">
            <div className="admin-dashboard-notification-wrap">
              <button type="button" className="admin-dashboard-notification" aria-label="Notifications" onClick={() => setShowNotifications((open) => !open)}><NotificationBell /><span /></button>
              {showNotifications && <div className="admin-dashboard-notification-panel"><strong>Notifications</strong><p>System is ready. New account activity will appear here.</p></div>}
            </div>
          </div>
        </header>

        <section className="admin-dashboard-stat-grid">
          <DashboardStat label="Low Stress (0–30)" value="48" note="Students (48%)" />
          <DashboardStat label="Moderate (31–60)" value="32" note="Students (32%)" />
          <DashboardStat label="High Stress (61–100)" value="20" note="Students (20%)" />
        </section>

        <section className="admin-dashboard-panels">
          <article className="admin-dashboard-panel"><h2>Stress Levels Today</h2><div className="admin-dashboard-chart"><div className="admin-dashboard-chart-labels"><span>200</span><span>150</span><span>100</span><span>50</span><span>0</span></div><svg viewBox="0 0 500 170" preserveAspectRatio="none" role="img" aria-label="Stress levels throughout today"><path d="M0 120 L83 105 L166 55 L249 35 L332 45 L415 70 L500 100" /><circle cx="0" cy="120" r="3" /><circle cx="83" cy="105" r="3" /><circle cx="166" cy="55" r="3" /><circle cx="249" cy="35" r="3" /><circle cx="332" cy="45" r="3" /><circle cx="415" cy="70" r="3" /><circle cx="500" cy="100" r="3" /></svg><div className="admin-dashboard-chart-times"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span></div></div></article>
          <article className="admin-dashboard-panel"><h2>Stress Distribution</h2><div className="admin-dashboard-donut-wrap"><div className="admin-dashboard-donut"><strong>100%</strong></div><div className="admin-dashboard-legend"><div><i /><span>Low (0–30): 48%</span></div><div><i className="moderate" /><span>Moderate (31–60): 32%</span></div><div><i className="high" /><span>High (61–100): 20%</span></div></div></div></article>
        </section>
      </main>
    </div>
  );
};

const DashboardStat: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <article className="admin-dashboard-stat"><span>{label}</span><strong>{value}</strong><small className="green">{note}</small></article>
);
