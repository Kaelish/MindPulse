import React from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import './AdminAnalyticsView.css';

interface AdminAnalyticsViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'results' | 'analytics' | 'profile') => void;
}

const metrics = [
  { label: 'Total Scans', value: '130,700', change: '+15.2% vs last period', tone: 'green', icon: '↗' },
  { label: 'Avg Accuracy', value: '94.2%', change: '+3.2% vs last period', tone: 'green', icon: '↗' },
  { label: 'Stress Reduction', value: '-18.5%', change: 'Improvement detected', tone: 'green', icon: '↘' },
  { label: 'User Satisfaction', value: '4.7/5.0', change: '+0.3 vs last period', tone: 'green', icon: '↗' },
];

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({ onSignOut, onNavigate }) => {
  return (
    <div className="admin-shell">
      <AdminSidebar onSignOut={onSignOut} activeView="analytics" onNavigate={onNavigate} />
      <main className="admin-main analytics-main">
        <header className="analytics-header">
          <div>
            <h1>Analytics</h1>
            <p>Comprehensive insights and performance metrics</p>
          </div>
          <div className="analytics-actions">
            <button type="button" className="analytics-icon-button" aria-label="Notifications"><NotificationBell /></button>
            <select className="analytics-select" defaultValue="6">
              <option value="6">Last 6 Months</option>
              <option value="12">Last 12 Months</option>
              <option value="1">This Month</option>
            </select>
            <button type="button" className="analytics-export-button">⇩ Export Report</button>
            <button type="button" className="analytics-signout-button" onClick={onSignOut}>Sign Out</button>
          </div>
        </header>

        <section className="analytics-metrics" aria-label="Performance metrics">
          {metrics.map((metric) => (
            <article className="analytics-metric-card" key={metric.label}>
              <div className="analytics-metric-heading">
                <span>{metric.label}</span>
                <b className={`metric-trend metric-trend-${metric.tone}`}>{metric.icon}</b>
              </div>
              <strong>{metric.value}</strong>
              <small>{metric.change}</small>
            </article>
          ))}
        </section>

        <section className="analytics-panel" aria-labelledby="monthly-trends-title">
          <h2 id="monthly-trends-title">Monthly Trends</h2>
          <div className="analytics-chart-wrap">
            <div className="analytics-y-axis" aria-hidden="true">
              <span>26000</span><span>19500</span><span>13000</span><span>6500</span><span>0</span>
            </div>
            <div className="analytics-chart-area">
              <div className="analytics-grid-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <svg className="analytics-chart" viewBox="0 0 700 240" role="img" aria-label="Total scans increased from January to June">
                <path className="analytics-area" d="M0 185 L140 180 L280 145 L420 108 L560 83 L700 58 L700 240 L0 240 Z" />
                <path className="analytics-line" d="M0 185 L140 180 L280 145 L420 108 L560 83 L700 58" />
                {[['0', '185'], ['140', '180'], ['280', '145'], ['420', '108'], ['560', '83'], ['700', '58']].map(([cx, cy]) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" />
                ))}
              </svg>
              <div className="analytics-x-axis" aria-hidden="true">
                {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'].map((month) => <span key={month}>{month}</span>)}
              </div>
            </div>
          </div>
          <div className="analytics-legend"><span /> Total Scans</div>
        </section>

        <section className="analytics-lower-grid">
          <article className="analytics-panel analytics-placeholder-panel"><h2>Stress Levels Overview</h2><div className="analytics-placeholder-bars"><i /><i /><i /><i /><i /><i /></div></article>
          <article className="analytics-panel analytics-placeholder-panel"><h2>User Engagement</h2><div className="analytics-donut"><b>78%</b></div></article>
        </section>
      </main>
    </div>
  );
};
