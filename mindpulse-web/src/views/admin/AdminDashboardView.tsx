import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminUsersView } from './AdminUsersView';
import { AdminResultsView } from './AdminResultsView';
import { AdminProfileSettingsView } from './AdminProfileSettingsView';
import { AdminSystemSettingsView } from './AdminSystemSettingsView';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { AdminOverviewStats, fetchAdminOverview } from '../../services/admin';
import './AdminDashboardView.css';

interface AdminDashboardViewProps {
  onSignOut: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onSignOut }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'users' | 'results' | 'analytics' | 'profile' | 'settings'>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchAdminOverview()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load the dashboard overview.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (activeView === 'analytics') {
    return <AdminAnalyticsView onSignOut={onSignOut} onNavigate={setActiveView} />;
  }
  if (activeView === 'users') return <AdminUsersView onSignOut={onSignOut} onNavigate={setActiveView} />;
  if (activeView === 'results') return <AdminResultsView onSignOut={onSignOut} onNavigate={setActiveView} />;
  if (activeView === 'profile') return <AdminProfileSettingsView onSignOut={onSignOut} onNavigate={setActiveView} />;
  if (activeView === 'settings') return <AdminSystemSettingsView onSignOut={onSignOut} onNavigate={setActiveView} />;

  const assessed = stats ? stats.assessed : 0;
  const share = (count: number) => (assessed ? Math.round((count / assessed) * 100) : 0);
  const bands = stats
    ? [
        { key: 'low', label: 'Low (0–30)', count: stats.low, color: '#33bd91' },
        { key: 'moderate', label: 'Moderate (31–60)', count: stats.moderate, color: '#ff9f16' },
        { key: 'high', label: 'High (61–100)', count: stats.high, color: '#ff414b' },
      ]
    : [];

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
              {showNotifications && <NotificationPanel variant="dashboard" />}
            </div>
          </div>
        </header>

        {!isLoading && !loadError && stats && stats.pendingApprovals > 0 && (
          <div
            style={{
              background: '#fff7ec',
              border: '1px solid #ffcf8f',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
            }}
          >
            <span style={{ color: '#8a5a00', fontWeight: 700 }}>
              {stats.pendingApprovals} doctor registration{stats.pendingApprovals === 1 ? '' : 's'} waiting
              for approval.
            </span>
            <button type="button" className="view-details-button" onClick={() => setActiveView('users')}>
              Review
            </button>
          </div>
        )}

        {isLoading && <div className="loading-state"><span className="spinner" /></div>}
        {!isLoading && loadError && (
          <div className="error-state">
            <p>{loadError}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
          </div>
        )}
        {!isLoading && !loadError && stats && (
          <>
            <section className="admin-dashboard-stat-grid">
              <DashboardStat label="Low Stress (0–30)" value={String(stats.low)} note={`Students (${share(stats.low)}%)`} />
              <DashboardStat label="Moderate (31–60)" value={String(stats.moderate)} note={`Students (${share(stats.moderate)}%)`} />
              <DashboardStat label="High Stress (61–100)" value={String(stats.high)} note={`Students (${share(stats.high)}%)`} />
            </section>

            <section className="admin-dashboard-panels">
              <article className="admin-dashboard-panel">
                <h2>Stress Distribution</h2>
                {assessed === 0 ? (
                  <p className="empty-table">No students have completed an assessment yet.</p>
                ) : (
                  <div className="admin-dashboard-chart">
                    {bands.map((band) => (
                      <div key={band.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span style={{ width: '128px', color: '#718096', fontSize: '0.66rem' }}>{band.label}</span>
                        <span style={{ flex: 1, height: '16px', borderRadius: '8px', background: '#eef2f6', overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${share(band.count)}%`, background: band.color, borderRadius: '8px' }} />
                        </span>
                        <strong style={{ width: '92px', textAlign: 'right', color: '#202938', fontSize: '0.68rem' }}>
                          {band.count} ({share(band.count)}%)
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
              <article className="admin-dashboard-panel">
                <h2>Account Overview</h2>
                <div className="admin-dashboard-legend">
                  <div><i /><span>Students: {stats.students}</span></div>
                  <div><i className="moderate" /><span>Doctors: {stats.doctors}</span></div>
                  <div><i className="high" /><span>Admins: {stats.admins}</span></div>
                  <div><i /><span>Total Assessments: {stats.sessions}</span></div>
                  <div><i className="moderate" /><span>Appointments: {stats.appointments}</span></div>
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const DashboardStat: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <article className="admin-dashboard-stat"><span>{label}</span><strong>{value}</strong><small className="green">{note}</small></article>
);
