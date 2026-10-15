import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { AdminAnalytics, bandForScore, fetchAdminAnalytics, fetchAdminResults } from '../../services/admin';
import './AdminAnalyticsView.css';

interface AdminAnalyticsViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'suggestions' | 'analytics' | 'profile' | 'settings') => void;
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({ onSignOut, onNavigate }) => {
  const [months, setMonths] = useState('0');
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchAdminAnalytics(Number(months))
      .then((data) => {
        if (active) setAnalytics(data);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load analytics.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [months, reloadKey]);

  const exportReport = async () => {
    setExporting(true);
    setExportError('');
    try {
      const rows = await fetchAdminResults();
      const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const lines = [['Student', 'Date', 'Score', 'Level', 'Heart Rate', 'Survey Score', 'Reaction Time (ms)', 'Emotion'].map(escape).join(',')];
      rows.forEach((row) => {
        const level = row.score != null ? bandForScore(row.score) : (row.stressLevel ?? '');
        lines.push([
          row.studentName,
          row.createdAt,
          row.score != null ? String(row.score) : '',
          level ? titleCase(level) : '',
          row.heartRate != null ? String(row.heartRate) : '',
          row.surveyScore != null ? String(row.surveyScore) : '',
          row.reactionTimeMs != null ? String(row.reactionTimeMs) : '',
          row.emotion ?? '',
        ].map(escape).join(','));
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mindpulse-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to export the report.');
    } finally {
      setExporting(false);
    }
  };

  const metrics = analytics
    ? [
        {
          label: 'Total Assessments',
          value: String(analytics.totalSessions),
          note: months === '0' ? 'All recorded sessions' : 'In selected period',
        },
        { label: 'Average Score', value: analytics.avgScore != null ? String(analytics.avgScore) : '—', note: 'Score out of 100' },
        { label: 'Assessed Students', value: `${analytics.assessedStudents} of ${analytics.students}`, note: `${analytics.students} students` },
        { label: 'Engagement', value: `${analytics.engagementPct}%`, note: `${analytics.assessedStudents} of ${analytics.students} students` },
      ]
    : [];

  const maxSessions = analytics ? Math.max(1, ...analytics.monthly.map((point) => point.sessions)) : 1;
  const yTicks = [maxSessions, Math.round(maxSessions * 0.75), Math.round(maxSessions * 0.5), Math.round(maxSessions * 0.25), 0];

  const assessedTotal = analytics ? analytics.low + analytics.moderate + analytics.high : 0;
  const bandShare = (count: number) => (assessedTotal ? Math.round((count / assessedTotal) * 100) : 0);
  const stressBands = analytics
    ? [
        { key: 'low', label: 'Low', count: analytics.low, color: '#0f9d63' },
        { key: 'moderate', label: 'Moderate', count: analytics.moderate, color: '#e0a63a' },
        { key: 'high', label: 'High', count: analytics.high, color: '#d64550' },
      ]
    : [];

  return (
    <div className="admin-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="analytics" onNavigate={onNavigate} />
      <main className="admin-main analytics-main">
        <header className="analytics-header">
          <div>
            <h1>Analytics</h1>
            <p>Comprehensive insights and performance metrics</p>
          </div>
          <div className="analytics-actions">
            <div className="account-actions">
              <button type="button" className="analytics-icon-button" aria-label="Notifications" onClick={() => setShowNotifications((open) => !open)}><NotificationBell /></button>
              {showNotifications && <NotificationPanel />}
            </div>
            <select className="analytics-select" value={months} onChange={(event) => setMonths(event.target.value)} aria-label="Analytics period">
              <option value="0">All Time</option>
              <option value="6">Last 6 Months</option>
              <option value="12">Last 12 Months</option>
              <option value="1">This Month</option>
            </select>
            <button type="button" className="analytics-export-button" onClick={exportReport} disabled={exporting}>
              {exporting ? 'Exporting…' : '⇩ Export Report'}
            </button>
          </div>
        </header>

        {exportError && <p className="error-inline">{exportError}</p>}

        {isLoading && <div className="loading-state"><span className="spinner" /></div>}
        {loadError && (
          <div className="error-state">
            <p>{loadError}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
          </div>
        )}
        {!isLoading && !loadError && analytics && (
          <>
            <section className="analytics-metrics" aria-label="Performance metrics">
              {metrics.map((metric) => (
                <article className="analytics-metric-card" key={metric.label}>
                  <div className="analytics-metric-heading">
                    <span>{metric.label}</span>
                  </div>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </article>
              ))}
            </section>

            <section className="analytics-panel" aria-labelledby="monthly-trends-title">
              <h2 id="monthly-trends-title">Monthly Trends</h2>
              <div className="analytics-chart-wrap">
                <div className="analytics-y-axis" aria-hidden="true">
                  {yTicks.map((tick, index) => <span key={`${index}-${tick}`}>{tick}</span>)}
                </div>
                <div className="analytics-chart-area">
                  <div className="analytics-grid-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '6px' }}>
                    {analytics.monthly.map((point) => (
                      <div
                        key={point.label}
                        className="analytics-bar"
                        title={`${point.label}: ${point.sessions} session${point.sessions === 1 ? '' : 's'}${point.avgScore != null ? `, avg score ${point.avgScore}` : ''}`}
                        style={{
                          flex: 1,
                          maxWidth: '48px',
                          height: `${(point.sessions / maxSessions) * 100}%`,
                          minHeight: point.sessions > 0 ? '4px' : '0',
                        }}
                      />
                    ))}
                  </div>
                  <div className="analytics-x-axis" aria-hidden="true">
                    {analytics.monthly.map((point) => <span key={point.label}>{point.label.toUpperCase()}</span>)}
                  </div>
                </div>
              </div>
              <div className="analytics-legend"><span /> Sessions per month</div>
            </section>

            <section className="analytics-lower-grid">
              <article className="analytics-panel analytics-placeholder-panel">
                <h2>Stress Levels Overview</h2>
                {assessedTotal === 0 ? (
                  <p className="empty-table">No assessed students yet.</p>
                ) : (
                  <>
                    <div className="analytics-placeholder-bars">
                      {stressBands.map((band) => (
                        <i
                          key={band.key}
                          title={`${band.label}: ${band.count} students (${bandShare(band.count)}%)`}
                          style={{ width: '18%', height: `${bandShare(band.count)}%`, background: band.color }}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px' }}>
                      {stressBands.map((band) => (
                        <span key={band.key} className="analytics-band-label">
                          {band.label} {band.count} ({bandShare(band.count)}%)
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </article>
              <article className="analytics-panel analytics-placeholder-panel">
                <h2>User Engagement</h2>
                <div
                  className="analytics-donut"
                  style={{ background: `conic-gradient(#14a3bd 0 ${analytics.engagementPct}%, #e8eef0 ${analytics.engagementPct}% 100%)` }}
                >
                  <b>{analytics.engagementPct}%</b>
                </div>
                <p className="analytics-caption">
                  {analytics.assessedStudents} of {analytics.students} students assessed
                </p>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
