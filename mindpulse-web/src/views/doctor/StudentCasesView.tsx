import React, { useEffect, useMemo, useState } from 'react';
import { fetchStudentCases, StudentCaseRecord } from '../../services/studentCases';
import { NotificationBell } from '../../components/NotificationBell';
import './StudentCasesView.css';

interface StudentCasesViewProps {
  onViewDetails?: (student: StudentCase) => void;
}

export type CaseStatus = 'High Risk' | 'Moderate Risk' | 'Low Risk';

export type StudentCase = StudentCaseRecord;

export const students: StudentCase[] = [];

export const StudentCasesView: React.FC<StudentCasesViewProps> = ({ onViewDetails }) => {
  const [loadedStudents, setLoadedStudents] = useState<StudentCase[]>(students);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  useEffect(() => {
    let active = true;
    void fetchStudentCases().then((records) => {
      if (active) setLoadedStudents(records);
    }).catch((error) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load student cases.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filteredStudents = useMemo(() => loadedStudents.filter((student) =>
    (status === 'All Status' || student.status === status) &&
    `${student.name} ${student.program}`.toLowerCase().includes(search.toLowerCase()),
  ), [loadedStudents, search, status]);

  return (
    <main className="main-panel student-cases-main">
      <header className="topbar student-cases-topbar">
        <div><h1>Student Cases</h1><p className="page-subtitle">Manage and review all assigned student cases</p></div>
        <div className="header-actions"><button type="button" className="export-report-button">⇩ Export Report</button><button type="button" className="notification-button" aria-label="Notifications"><NotificationBell /></button></div>
      </header>
      <section className="case-summary-grid"><Summary label="Total Cases" value={String(loadedStudents.length)} /><Summary label="High Risk" value={String(loadedStudents.filter((student) => student.status === 'High Risk').length)} /><Summary label="Moderate Risk" value={String(loadedStudents.filter((student) => student.status === 'Moderate Risk').length)} /><Summary label="Low Risk" value={String(loadedStudents.filter((student) => student.status === 'Low Risk').length)} /></section>
      <section className="case-filter-bar"><label className="case-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, ID, or program" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter case status"><option>All Status</option><option>High Risk</option><option>Moderate Risk</option><option>Low Risk</option></select></section>
      <section className="case-table-panel">
        {isLoading && <p className="case-loading">Loading student cases...</p>}
        {loadError && <p className="case-load-error">{loadError}</p>}
        <div className="case-table-wrap">
          <table className="case-table">
            <thead><tr><th>Student</th><th>Program</th><th>Status</th><th>Last Assessment</th><th>Stress Level</th><th>Trend</th><th>Actions</th></tr></thead>
            <tbody>{filteredStudents.map((student) => (
              <tr key={student.id}>
                <td><div className="case-student"><span className="case-avatar">{student.initials}</span><strong>{student.name}</strong></div></td>
                <td><span>{student.program}</span><small>Age: {student.age}</small></td>
                <td><span className={`case-status ${student.status.toLowerCase().replace(' ', '-')}`}>{student.status}</span></td>
                <td className="case-muted">{student.lastAssessment}</td><td>{student.score}</td>
                <td><span className={`case-trend ${student.trend.toLowerCase()}`}>{student.trend}</span></td>
                <td><button type="button" className="view-details-button" onClick={() => onViewDetails?.(student)}>View Details</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {filteredStudents.length === 0 && <p className="empty-table">No student cases match your filters.</p>}
      </section>
    </main>
  );
};

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => <article className="case-summary-card"><span>{label}</span><strong>{value}</strong></article>;
