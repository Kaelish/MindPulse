import React, { useCallback, useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminUsersView } from './AdminUsersView';
import { AdminResultsView } from './AdminResultsView';
import { AdminProfileSettingsView } from './AdminProfileSettingsView';
import { AdminSystemSettingsView } from './AdminSystemSettingsView';
import { AdminAssessmentView } from './AdminAssessmentView';
import { AdminRecordsView } from './AdminRecordsView';
import { AdminSuggestionsView } from './AdminSuggestionsView';
import { AdminGenerateReportsView } from './AdminGenerateReportsView';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { BrandLogo } from '../../components/BrandLogo';
import { AdminNotificationsView } from './AdminNotificationsView';
import { AdminDashboardCharts, AdminOverviewStats, fetchAdminDashboardCharts, fetchAdminOverview } from '../../services/admin';
import { fetchUnreadNotificationCount } from '../../services/notifications';
import { ActivityLineChart, AppointmentStatusDonut } from './AdminDashboardCharts';
import './AdminDashboardView.css';

interface AdminDashboardViewProps {
  onSignOut: () => void;
}

type AdminView =
  | 'dashboard'
  | 'users'
  | 'assessment'
  | 'results'
  | 'records'
  | 'reports'
  | 'analytics'
  | 'profile'
  | 'settings'
  | 'suggestions'
  | 'notifications';

const viewFromPath = (pathname: string): AdminView => {
  switch (pathname.replace(/\/+$/, '').split('/').pop()?.toLowerCase()) {
    case 'users': return 'users';
    case 'assessment-tools': return 'assessment';
    case 'results': return 'results';
    case 'records': return 'records';
    case 'suggestions': return 'suggestions';
    case 'analytics': return 'analytics';
    case 'settings': return 'settings';
    case 'notifications': return 'notifications';
    default: return 'dashboard';
  }
};

const pathForView = (view: AdminView): string => {
  switch (view) {
    case 'users': return '/users';
    case 'assessment': return '/assessment-tools';
    case 'results': return '/results';
    case 'records': return '/records';
    case 'reports':
    case 'analytics': return '/analytics';
    case 'suggestions': return '/suggestions';
    case 'profile':
    case 'settings': return '/settings';
    case 'notifications': return '/notifications';
    default: return '/dashboard';
  }
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onSignOut }) => {
  const [activeView, setActiveView] = useState<AdminView>(() => viewFromPath(window.location.pathname));
  const [showNotifications, setShowNotifications] = useState(false);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [charts, setCharts] = useState<AdminDashboardCharts | null>(null);
  const [chartsError, setChartsError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshUnread = useCallback(() => {
    fetchUnreadNotificationCount()
      .then(setUnreadNotifications)
      .catch(() => setUnreadNotifications(0));
  }, []);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  const navigateAdminView = (view: AdminView) => {
    const pathname = pathForView(view);
    if (window.location.pathname !== pathname) window.history.pushState({}, '', pathname);
    setActiveView(view);
  };

  useEffect(() => {
    const syncViewWithLocation = () => setActiveView(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', syncViewWithLocation);
    return () => window.removeEventListener('popstate', syncViewWithLocation);
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    setChartsError('');
    setCharts(null);
    fetchAdminDashboardCharts()
      .then((chartData) => {
        if (active) setCharts(chartData);
      })
      .catch((error) => {
        if (active) setChartsError(error instanceof Error ? error.message : 'Unable to load the charts.');
      });
    fetchAdminOverview()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the dashboard overview.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (activeView === 'analytics') {
    return <AdminAnalyticsView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  }
  if (activeView === 'users') return <AdminUsersView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  if (activeView === 'assessment') return <AdminAssessmentView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  if (activeView === 'results') return <AdminResultsView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  if (activeView === 'records') return <AdminRecordsView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  if (activeView === 'suggestions') return <AdminSuggestionsView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  if (activeView === 'reports') return <AdminGenerateReportsView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  if (activeView === 'profile') return <AdminProfileSettingsView onSignOut={onSignOut} onNavigate={navigateAdminView} />;
  if (activeView === 'settings') return <AdminSystemSettingsView onSignOut={onSignOut} onNavigate={navigateAdminView} />;

  if (activeView === 'notifications') {
    return (
      <div className="doctor-shell admin-scope">
        <AdminSidebar onSignOut={onSignOut} activeView="notifications" onNavigate={navigateAdminView} />
        <AdminNotificationsView onNavigate={(pathname) => {
          const destination = viewFromPath(pathname);
          navigateAdminView(destination);
        }} />
      </div>
    );
  }

  const assessed = stats ? stats.assessed : 0;
  const share = (count: number) => (assessed ? Math.round((count / assessed) * 100) : 0);
  const bands = stats
    ? [
        { key: 'low', label: 'Low (0–35)', count: stats.low, color: '#0f9d63' },
        { key: 'moderate', label: 'Moderate (36–60)', count: stats.moderate, color: '#e0a63a' },
        { key: 'high', label: 'High (61–100)', count: stats.high, color: '#d64550' },
      ]
    : [];

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView={activeView} onNavigate={navigateAdminView} />

      <main className="admin-dashboard-main">
        <header className="admin-dashboard-header">
          <div className="admin-dashboard-title">
            <span className="admin-dashboard-logo">
              <BrandLogo className="brand-logo-img" />
            </span>
            <div>
              <div className="admin-dashboard-eyebrow">System Management</div>
              <h1>Admin Dashboard</h1>
            </div>
          </div>
          <div className="admin-dashboard-actions">
            <div className="admin-dashboard-notification-wrap">
              <button
                type="button"
                className="admin-dashboard-notification"
                aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
                onClick={() => {
                  setShowNotifications((open) => !open);
                  refreshUnread();
                }}
              >
                <NotificationBell />
                {unreadNotifications > 0 && <span />}
              </button>
              {showNotifications && <NotificationPanel variant="dashboard" onChanged={refreshUnread} />}
            </div>
          </div>
        </header>

        {!isLoading && !loadError && stats && stats.pendingApprovals > 0 && (
          <div className="admin-alert">
            <span>
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
              <DashboardStat label="Low Stress (0–35)" value={String(stats.low)} note={`Students (${share(stats.low)}%)`} />
              <DashboardStat label="Moderate (36–60)" value={String(stats.moderate)} note={`Students (${share(stats.moderate)}%)`} />
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
                      <div key={band.key} className="admin-dashboard-bar">
                        <span className="admin-dashboard-bar-label">{band.label}</span>
                        <span className="admin-dashboard-bar-track">
                          <span
                            className="admin-dashboard-bar-fill"
                            style={{ width: `${share(band.count)}%`, background: band.color }}
                          />
                        </span>
                        <strong className="admin-dashboard-bar-value">
                          {band.count} ({share(band.count)}%)
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
              <article className="admin-dashboard-panel">
                <h2>Appointments by Status</h2>
                {charts ? (
                  <AppointmentStatusDonut statuses={charts.statuses} />
                ) : chartsError ? (
                  <p className="admin-chart-empty">{chartsError}</p>
                ) : (
                  <div className="loading-state"><span className="spinner" /></div>
                )}
              </article>
              <article className="admin-dashboard-panel admin-dashboard-panel--wide">
                <h2>Activity</h2>
                {charts ? (
                  <ActivityLineChart weeks={charts.weeks} rangeLabel={charts.rangeLabel} />
                ) : chartsError ? (
                  <p className="admin-chart-empty">{chartsError}</p>
                ) : (
                  <div className="loading-state"><span className="spinner" /></div>
                )}
              </article>
              <article className="admin-dashboard-panel admin-dashboard-panel--wide">
                <h2>Account Overview</h2>
                <div className="admin-dashboard-legend admin-dashboard-legend--chips">
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
