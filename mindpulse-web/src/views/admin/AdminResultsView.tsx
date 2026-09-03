import React from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';

interface AdminResultsViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'results' | 'analytics') => void;
}

const results = [
  { id: 'MP-1042', patient: 'John Doe', date: 'Mar 18, 2026', score: 68, level: 'High', heartRate: '88 bpm', reaction: '430 ms' },
  { id: 'MP-1038', patient: 'John Doe', date: 'Mar 14, 2026', score: 42, level: 'Moderate', heartRate: '76 bpm', reaction: '380 ms' },
  { id: 'MP-1031', patient: 'John Doe', date: 'Mar 10, 2026', score: 85, level: 'High', heartRate: '94 bpm', reaction: '490 ms' },
  { id: 'MP-1025', patient: 'John Doe', date: 'Mar 5, 2026', score: 22, level: 'Low', heartRate: '64 bpm', reaction: '320 ms' },
];

export const AdminResultsView: React.FC<AdminResultsViewProps> = ({ onSignOut, onNavigate }) => (
  <div className="doctor-shell">
    <AdminSidebar onSignOut={onSignOut} activeView="results" onNavigate={onNavigate} />
    <main className="main-panel">
      <header className="topbar">
        <div><div className="eyebrow">Assessment Tools</div><h1>Results</h1></div>
        <div className="header-actions"><button type="button" className="ghost-button">Filter</button><button type="button" className="primary-button">Export results</button></div>
      </header>
      <section className="stats-grid compact-stats">
        <article className="stat-card tone-blue"><div className="stat-label">Assessments</div><div className="stat-value">24</div><div className="stat-change">This month</div></article>
        <article className="stat-card tone-purple"><div className="stat-label">Average score</div><div className="stat-value">54</div><div className="stat-change">Across all patients</div></article>
        <article className="stat-card tone-green"><div className="stat-label">Low stress</div><div className="stat-value">42%</div><div className="stat-change">Of completed results</div></article>
      </section>
      <section className="content-panel">
        <div className="panel-heading"><div><h2>Recent assessment results</h2><p>Review the latest multi-signal stress measurements.</p></div><select className="table-select" aria-label="Filter results"><option>All levels</option><option>High</option><option>Moderate</option><option>Low</option></select></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Assessment</th><th>Patient</th><th>Stress score</th><th>Heart rate</th><th>Reaction</th><th>Date</th></tr></thead><tbody>{results.map((result) => <tr key={result.id}>
          <td><strong>{result.id}</strong><span className="cell-muted">Full assessment</span></td><td>{result.patient}</td><td><span className={`status-pill status-${result.level.toLowerCase()}`}>{result.score}/100 · {result.level}</span></td><td>{result.heartRate}</td><td>{result.reaction}</td><td className="cell-muted">{result.date}</td>
        </tr>)}</tbody></table></div>
      </section>
    </main>
  </div>
);
