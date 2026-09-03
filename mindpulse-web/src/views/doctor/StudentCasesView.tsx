import React, { useMemo, useState } from 'react';

interface StudentCasesViewProps {
  onViewDetails?: () => void;
}

type CaseStatus = 'High Risk' | 'Moderate Risk' | 'Low Risk';

const students = [
  { name: 'John Doe', program: 'Computer Science', age: 20, status: 'High Risk' as CaseStatus, lastAssessment: '2 hours ago', score: 85, trend: 'Increasing' },
  { name: 'Sarah Smith', program: 'Engineering', age: 21, status: 'Moderate Risk' as CaseStatus, lastAssessment: '5 hours ago', score: 60, trend: 'Stable' },
  { name: 'Mike Johnson', program: 'Psychology', age: 19, status: 'Low Risk' as CaseStatus, lastAssessment: '2 days ago', score: 34, trend: 'Decreasing' },
  { name: 'Emma Wilson', program: 'Business Administration', age: 22, status: 'Low Risk' as CaseStatus, lastAssessment: '1 hour ago', score: 12, trend: 'Decreasing' },
  { name: 'Alex Brown', program: 'Nursing', age: 19, status: 'Low Risk' as CaseStatus, lastAssessment: '30 minutes ago', score: 22, trend: 'Decreasing' },
];

export const StudentCasesView: React.FC<StudentCasesViewProps> = ({ onViewDetails }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const filteredStudents = useMemo(() => students.filter((student) =>
    (status === 'All Status' || student.status === status) &&
    `${student.name} ${student.program}`.toLowerCase().includes(search.toLowerCase()),
  ), [search, status]);

  return (
    <main className="main-panel student-cases-main">
      <header className="topbar student-cases-topbar">
        <div><h1>Student Cases</h1><p className="page-subtitle">Manage and review all assigned student cases</p></div>
        <div className="header-actions"><button type="button" className="export-report-button">⇩ Export Report</button><button type="button" className="notification-button" aria-label="Notifications">🔔</button></div>
      </header>
      <section className="case-summary-grid"><Summary label="Total Cases" value="14" /><Summary label="High Risk" value="4" /><Summary label="Moderate Risk" value="7" /><Summary label="Low Risk" value="3" /></section>
      <section className="case-filter-bar"><label className="case-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, ID, or program" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter case status"><option>All Status</option><option>High Risk</option><option>Moderate Risk</option><option>Low Risk</option></select></section>
      <section className="case-table-panel"><div className="case-table-wrap"><table className="case-table"><thead><tr><th>Student</th><th>Program</th><th>Status</th><th>Last Assessment</th><th>Stress Level</th><th>Trend</th><th>Actions</th></tr></thead><tbody>{filteredStudents.map((student) => <tr key={student.name}><td><div className="case-student"><span className="case-avatar">●</span><strong>{student.name}</strong></div></td><td><span>{student.program}</span><small>Age: {student.age}</small></td><td><span className={`case-status ${student.status.toLowerCase().replace(' ', '-')}`}>{student.status}</span></td><td className="case-muted">{student.lastAssessment}</td><td>{student.score}</td><td><span className={`case-trend ${student.trend.toLowerCase()}`}>{student.trend}</span></td><td><button type="button" className="view-details-button" onClick={onViewDetails}>View Details</button></td></tr>)}</tbody></table></div>{filteredStudents.length === 0 && <p className="empty-table">No student cases match your filters.</p>}</section>
    </main>
  );
};

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => <article className="case-summary-card"><span>{label}</span><strong>{value}</strong></article>;
