import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchStudentCases, StudentCaseRecord } from '../../services/studentCases';
import { DoctorEmpty, DoctorError, DoctorLoading, DoctorNotifications, DoctorResultCount } from '../../components/doctor/DoctorChrome';
import './StudentCasesView.css';

interface StudentCasesViewProps {
  onViewDetails?: (student: StudentCase) => void;
}

export type CaseStatus = 'High Risk' | 'Moderate Risk' | 'Low Risk';

export type StudentCase = StudentCaseRecord;

export const students: StudentCase[] = [];

const CSV_COLUMNS: { key: keyof StudentCase; label: string }[] = [
  { key: 'name', label: 'Student' },
  { key: 'email', label: 'Email' },
  { key: 'program', label: 'Program' },
  { key: 'age', label: 'Age' },
  { key: 'status', label: 'Status' },
  { key: 'lastAssessment', label: 'Last Assessment' },
  { key: 'score', label: 'Stress Level' },
  { key: 'trend', label: 'Trend' },
];

const escapeCsvCell = (value: unknown): string => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadCsv = (rows: StudentCase[]): void => {
  const header = CSV_COLUMNS.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows.map((row) => CSV_COLUMNS.map((column) => escapeCsvCell(row[column.key])).join(','));
  const csv = [header, ...body].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `student-cases-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const StudentCasesView: React.FC<StudentCasesViewProps> = ({ onViewDetails }) => {
  const [loadedStudents, setLoadedStudents] = useState<StudentCase[]>(students);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    void fetchStudentCases()
      .then((records) => {
        if (active) setLoadedStudents(records);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load student cases.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const filteredStudents = useMemo(
    () =>
      loadedStudents.filter(
        (student) =>
          (status === 'All Status' || student.status === status) &&
          `${student.name} ${student.program}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [loadedStudents, search, status],
  );

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <main className="main-panel student-cases-main">
      <header className="topbar student-cases-topbar">
        <div>
          <h1>Student Cases</h1>
          <p className="page-subtitle">Manage and review all assigned student cases</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="export-report-button"
            onClick={() => downloadCsv(filteredStudents)}
            disabled={isLoading || !!loadError || filteredStudents.length === 0}
            title={filteredStudents.length === 0 ? 'There are no cases to export yet' : undefined}
          >
            Export Report
          </button>
          <DoctorNotifications />
        </div>
      </header>

      <section className="case-summary-grid" aria-label="Case summary">
        <Summary label="Total Cases" value={String(loadedStudents.length)} />
        <Summary label="High Risk" value={String(loadedStudents.filter((student) => student.status === 'High Risk').length)} />
        <Summary label="Moderate Risk" value={String(loadedStudents.filter((student) => student.status === 'Moderate Risk').length)} />
        <Summary label="Low Risk" value={String(loadedStudents.filter((student) => student.status === 'Low Risk').length)} />
      </section>

      <section className="case-filter-bar">
        <label className="case-search">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, ID, or program"
            aria-label="Search student cases"
          />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter case status">
          <option>All Status</option>
          <option>High Risk</option>
          <option>Moderate Risk</option>
          <option>Low Risk</option>
        </select>
        <DoctorResultCount shown={filteredStudents.length} total={loadedStudents.length} noun="cases" />
      </section>

      <section className="case-table-panel">
        {isLoading && <DoctorLoading label="Loading student cases…" variant="skeleton" rows={5} />}

        {!isLoading && loadError && <DoctorError message={loadError} onRetry={retry} />}

        {!isLoading && !loadError && (
          <>
            {filteredStudents.length > 0 ? (
              <div className="case-table-wrap">
                <table className="case-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Program</th>
                      <th>Status</th>
                      <th>Last Assessment</th>
                      <th>Stress Level</th>
                      <th>Trend</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <div className="case-student">
                            <span className="case-avatar">{student.initials}</span>
                            <strong>{student.name}</strong>
                          </div>
                        </td>
                        <td>
                          <span>{student.program}</span>
                          <small>Age: {student.age}</small>
                        </td>
                        <td>
                          <span className={`case-status ${student.status.toLowerCase().replace(' ', '-')}`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="case-muted">{student.lastAssessment}</td>
                        <td>{student.score}</td>
                        <td>
                          <span className={`case-trend ${student.trend.toLowerCase()}`}>{student.trend}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="view-details-button"
                            onClick={() => onViewDetails?.(student)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : loadedStudents.length === 0 ? (
              <DoctorEmpty
                title="No student cases yet"
                description="Assigned students will appear here once they book a session with you."
              />
            ) : (
              <DoctorEmpty
                title="No cases match your filters"
                description="Try a different search term or switch the status filter back to All Status."
                action={
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setSearch('');
                      setStatus('All Status');
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            )}
          </>
        )}
      </section>
    </main>
  );
};

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <article className="case-summary-card">
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
);
