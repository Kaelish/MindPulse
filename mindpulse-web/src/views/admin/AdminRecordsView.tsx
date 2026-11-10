import React, { useEffect, useMemo, useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { AdminResultRow, assessmentNameOf, bandForScore, fetchAdminResults } from '../../services/admin';
import {
  AtRiskRecordRow,
  ConsultationRecordRow,
  RecordSessionRow,
  StudentRecordRow,
  fetchConsultationRecords,
  fetchRecordBundles,
  fetchStudentRecordSessions,
} from '../../services/adminRecords';
import './AdminRecordsView.css';

type RecordsTab = 'assessments' | 'students' | 'at-risk' | 'consultations';

interface AdminRecordsViewProps {
  onSignOut: () => void;
  onNavigate: (view: AdminNavView) => void;
}

const TAB_META: Record<RecordsTab, { label: string; title: string; subtitle: string }> = {
  assessments: {
    label: 'Assessments Records',
    title: 'View Assessment Records',
    subtitle: 'Complete history of all assessments',
  },
  students: {
    label: 'Patient Records',
    title: 'Maintain Patient Records',
    subtitle: 'Comprehensive patient profile and history',
  },
  'at-risk': {
    label: 'At-Risk Patients',
    title: 'Identify At-Risk Patients',
    subtitle: 'Patients requiring immediate attention and intervention',
  },
  consultations: {
    label: 'Consultation Records',
    title: 'View Consultation Records',
    subtitle: 'Consultations booked or completed, with patient note status',
  },
};

const TAB_ORDER: RecordsTab[] = ['assessments', 'students', 'at-risk', 'consultations'];

const pad = (value: number) => String(value).padStart(2, '0');

const dayKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatDate = (iso: string | null) => (iso ? dayKey(iso) : '—');

const formatStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const levelPillClass = (level: string | null) => {
  const normalized = (level ?? '').toLowerCase();
  if (normalized === 'low' || normalized === 'moderate' || normalized === 'high') {
    return `status-pill status-pill-${normalized}`;
  }
  return 'status-pill status-pill-grey';
};

const levelOfResult = (row: AdminResultRow): string | null =>
  row.score != null ? titleCase(bandForScore(row.score)) : row.stressLevel;

const TREND_GLYPH: Record<string, { glyph: string; tone: string }> = {
  Increasing: { glyph: '▲', tone: 'up' },
  Decreasing: { glyph: '▼', tone: 'down' },
  Stable: { glyph: '–', tone: 'flat' },
  New: { glyph: '•', tone: 'flat' },
  'No assessment': { glyph: '—', tone: 'flat' },
};

interface RecordData {
  assessments: AdminResultRow[];
  students: StudentRecordRow[];
  atRisk: AtRiskRecordRow[];
  consultations: ConsultationRecordRow[];
}

export const AdminRecordsView: React.FC<AdminRecordsViewProps> = ({ onSignOut, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<RecordsTab>('assessments');
  const [showNotifications, setShowNotifications] = useState(false);

  const [data, setData] = useState<RecordData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [riskSearch, setRiskSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [consultSearch, setConsultSearch] = useState('');

  const [viewing, setViewing] = useState<AdminResultRow | null>(null);
  const [viewingConsultation, setViewingConsultation] = useState<ConsultationRecordRow | null>(null);
  const [historyFor, setHistoryFor] = useState<StudentRecordRow | null>(null);
  const [historyRows, setHistoryRows] = useState<RecordSessionRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    Promise.all([fetchAdminResults(), fetchRecordBundles(), fetchConsultationRecords()])
      .then(([assessments, bundles, consultations]) => {
        if (active) {
          setData({
            assessments,
            students: bundles.students,
            atRisk: bundles.atRisk,
            consultations,
          });
        }
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load records.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const filteredAssessments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.assessments ?? []).filter((row) => {
      if (levelFilter !== 'all') {
        const level = levelOfResult(row);
        if (!level || level.toLowerCase() !== levelFilter) return false;
      }
      if (needle && !`${row.studentName} ${row.id.slice(0, 8)}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, search, levelFilter]);

  const programOptions = useMemo(() => {
    const programs = new Set<string>();
    for (const student of data?.students ?? []) {
      if (student.program && student.program !== '—') programs.add(student.program);
    }
    return Array.from(programs).sort();
  }, [data]);

  const filteredStudents = useMemo(() => {
    const needle = studentSearch.trim().toLowerCase();
    return (data?.students ?? []).filter((student) => {
      if (programFilter !== 'all' && student.program !== programFilter) return false;
      if (needle && !`${student.name} ${student.studentNo} ${student.email}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, studentSearch, programFilter]);

  const filteredAtRisk = useMemo(() => {
    const needle = riskSearch.trim().toLowerCase();
    return (data?.atRisk ?? []).filter((row) => {
      if (tierFilter !== 'all' && row.riskTier !== tierFilter) return false;
      if (needle && !`${row.name} ${row.studentNo} ${row.email}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, riskSearch, tierFilter]);

  const filteredConsultations = useMemo(() => {
    const needle = consultSearch.trim().toLowerCase();
    return (data?.consultations ?? []).filter((row) => {
      if (
        needle &&
        !`${row.studentName} ${row.studentEmail} ${row.doctorName}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [data, consultSearch]);

  const riskCounts = useMemo(() => {    const rows = data?.atRisk ?? [];
    return {
      total: rows.length,
      critical: rows.filter((row) => row.riskTier === 'critical').length,
      high: rows.filter((row) => row.riskTier === 'high').length,
      unassigned: rows.filter((row) => !row.assignedDoctor).length,
    };
  }, [data]);

  const openHistory = async (student: StudentRecordRow) => {
    setHistoryFor(student);
    setHistoryRows(null);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      setHistoryRows(await fetchStudentRecordSessions(student.userId));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Unable to load session history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openMail = (row: AtRiskRecordRow, kind: 'contact' | 'email') => {
    const subject =
      kind === 'contact'
        ? `MindPulse support check-in — ${row.name}`
        : `MindPulse assessment follow-up — ${row.studentNo}`;
    const body =
      kind === 'contact'
        ? `Hello ${row.name},\n\nOur records show your most recent stress assessment was flagged as ${row.riskLabel} (score ${row.score}/100) on ${formatDate(row.lastAssessment)}. We would like to check in and connect you with support.\n\n— MindPulse Admin`
        : '';
    const href = `mailto:${row.email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
    window.location.href = href;
  };

  const callStudent = (row: AtRiskRecordRow) => {
    if (row.phone) window.location.href = `tel:${row.phone}`;
  };

  const meta = TAB_META[activeTab];

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="records" onNavigate={onNavigate} />

      <main className="main-panel records-main">
        <header className="topbar records-topbar">
          <div>
            <h1>
              {activeTab === 'at-risk' && (
                <span className="records-title-flag" aria-hidden="true">
                  ⚑
                </span>
              )}
              {meta.title}
            </h1>
            <p className="page-subtitle">{meta.subtitle}</p>
          </div>
          <div className="header-actions">
            <div className="account-actions">
              <button type="button" className="records-primary-button" onClick={() => onNavigate('reports')}>
                ⇗ Generate Reports
              </button>
              <button
                type="button"
                className="notification-button"
                aria-label="Notifications"
                onClick={() => setShowNotifications((open) => !open)}
              >
                <NotificationBell />
              </button>
              {showNotifications && <NotificationPanel />}
            </div>
          </div>
        </header>

        <nav className="records-tabs" aria-label="Records sections">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`records-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_META[tab].label}
            </button>
          ))}
        </nav>

        {isLoading && (
          <div className="records-panel">
            <div className="loading-state">
              <span className="spinner" />
            </div>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="records-panel">
            <div className="error-state">
              <p>{loadError}</p>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !loadError && data && (
          <>
            {activeTab === 'assessments' && (
              <section className="records-panel">
                <div className="records-toolbar">
                  <label className="records-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search patient name or session ID"
                    />
                  </label>
                  <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} aria-label="Filter stress level">
                    <option value="all">All levels</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                  <span className="records-count">{filteredAssessments.length} records</span>
                </div>

                {filteredAssessments.length === 0 ? (
                  <p className="empty-table">
                    {data.assessments.length === 0
                      ? 'No assessment records yet.'
                      : 'No records match your search and filters.'}
                  </p>
                ) : (
                  <div className="records-table-wrap">
                    <table className="data-table records-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Date</th>
                          <th>Assessment</th>
                          <th>Score</th>
                          <th>Level</th>
                          <th>Survey</th>
                          <th>Heart Rate</th>
                          <th>Emotion</th>
                          <th>Reaction</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssessments.map((row) => {
                          const level = levelOfResult(row);
                          return (
                            <tr key={row.id}>
                              <td>
                                <strong>{row.studentName}</strong>
                                <small className="cell-muted">{row.id.slice(0, 8)}</small>
                              </td>
                              <td>{formatStamp(row.createdAt)}</td>
                              <td>{assessmentNameOf(row)}</td>
                              <td>{row.score == null ? '—' : `${row.score}/100`}</td>
                              <td>
                                <span className={levelPillClass(level)}>{level ?? '—'}</span>
                              </td>
                              <td>{row.surveyScore == null ? '—' : `${row.surveyScore}/100`}</td>
                              <td>{row.heartRate == null ? '—' : `${row.heartRate} bpm`}</td>
                              <td>{row.emotion ?? '—'}</td>
                              <td>{row.reactionTimeMs == null ? '—' : `${row.reactionTimeMs} ms`}</td>
                              <td>
                                <button type="button" className="records-row-button" onClick={() => setViewing(row)}>
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'students' && (
              <section className="records-panel">
                <div className="records-toolbar">
                  <label className="records-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      placeholder="Search name, patient no, or email"
                    />
                  </label>
                  <select
                    value={programFilter}
                    onChange={(event) => setProgramFilter(event.target.value)}
                    aria-label="Filter program"
                  >
                    <option value="all">All programs</option>
                    {programOptions.map((program) => (
                      <option key={program} value={program}>
                        {program}
                      </option>
                    ))}
                  </select>
                  <span className="records-count">{filteredStudents.length} patients</span>
                </div>

                {filteredStudents.length === 0 ? (
                  <p className="empty-table">
                    {data.students.length === 0 ? 'No patient records yet.' : 'No patients match your filters.'}
                  </p>
                ) : (
                  <div className="records-table-wrap">
                    <table className="data-table records-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Patient No</th>
                          <th>Program</th>
                          <th>Year</th>
                          <th>Assessments</th>
                          <th>Last Assessment</th>
                          <th>Score</th>
                          <th>Trend</th>
                          <th>Assigned Doctor</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => {
                          const trend = TREND_GLYPH[student.trend] ?? TREND_GLYPH.Stable;
                          return (
                            <tr key={student.userId}>
                              <td>
                                <span className="records-person">
                                  <i className="records-avatar sm">{student.initials}</i>
                                  <span>
                                    <strong>{student.name}</strong>
                                    <small className="cell-muted">{student.email}</small>
                                  </span>
                                </span>
                              </td>
                              <td>{student.studentNo}</td>
                              <td>{student.program}</td>
                              <td>{student.year}</td>
                              <td>{student.sessions}</td>
                              <td>{formatDate(student.lastAssessment)}</td>
                              <td>
                                {student.score == null ? (
                                  '—'
                                ) : (
                                  <span className={levelPillClass(student.level)}>
                                    {student.score}/100 · {student.level}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`records-trend ${trend.tone}`}>
                                  {trend.glyph} {student.trend}
                                </span>
                              </td>
                              <td>{student.assignedDoctor ?? 'Not assigned'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="records-row-button"
                                  onClick={() => void openHistory(student)}
                                >
                                  History
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'at-risk' && (
              <>
                <div className="records-stat-row">
                  <article className="records-stat">
                    <span>At-Risk Patients</span>
                    <strong>{riskCounts.total}</strong>
                  </article>
                  <article className="records-stat danger">
                    <span>Critical Risk</span>
                    <strong>{riskCounts.critical}</strong>
                  </article>
                  <article className="records-stat warning">
                    <span>High Risk</span>
                    <strong>{riskCounts.high}</strong>
                  </article>
                  <article className="records-stat neutral">
                    <span>Not Assigned</span>
                    <strong>{riskCounts.unassigned}</strong>
                  </article>
                </div>

                <section className="records-panel">
                  <div className="records-toolbar">
                    <label className="records-search">
                      <span aria-hidden="true">⌕</span>
                      <input
                        value={riskSearch}
                        onChange={(event) => setRiskSearch(event.target.value)}
                        placeholder="Search patient name or ID"
                      />
                    </label>
                    <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} aria-label="Filter risk tier">
                      <option value="all">All at-risk</option>
                      <option value="critical">Critical only</option>
                      <option value="high">High only</option>
                    </select>
                    <span className="records-count">{filteredAtRisk.length} patients</span>
                  </div>

                  {filteredAtRisk.length === 0 ? (
                    <p className="empty-table">
                      {data.atRisk.length === 0
                        ? 'No patients currently meet the at-risk criteria.'
                        : 'No patients match your filters.'}
                    </p>
                  ) : (
                    <div className="records-risk-grid">
                      {filteredAtRisk.map((row) => (
                        <article className="records-risk-card" key={row.userId}>
                          <div className="records-risk-head">
                            <i className="records-avatar">{row.initials}</i>
                            <div className="records-risk-identity">
                              <strong>{row.name}</strong>
                              <small>
                                {row.program}
                                {row.program !== '—' && row.year !== '—' ? ` · ${row.year}` : ''}
                              </small>
                            </div>
                            <div className="records-badges">
                              <span className={`records-risk-pill ${row.riskTier}`}>{row.riskLabel}</span>
                              <span
                                className={`records-care-pill ${
                                  row.careStatus === 'In Treatment'
                                    ? 'treatment'
                                    : row.careStatus === 'Contacted'
                                    ? 'contacted'
                                    : 'pending'
                                }`}
                              >
                                {row.careStatus}
                              </span>
                            </div>
                          </div>

                          <div className="records-risk-meta">
                            <div>
                              <span>Last Assessment</span>
                              <strong>{formatDate(row.lastAssessment)}</strong>
                            </div>
                            <div>
                              <span>Risk Score</span>
                              <strong className={row.riskTier === 'critical' ? 'danger-text' : 'warning-text'}>
                                {row.score}/100
                              </strong>
                            </div>
                            <div>
                              <span>Assigned Doctor</span>
                              <strong>{row.assignedDoctor ?? 'Not assigned'}</strong>
                            </div>
                            <div>
                              <span>Patient ID</span>
                              <strong>{row.studentNo}</strong>
                            </div>
                          </div>

                          <div className="records-risk-actions">
                            <button
                              type="button"
                              className="records-action primary"
                              onClick={() => openMail(row, 'contact')}
                            >
                              ✉ Contact
                            </button>
                            <button type="button" className="records-action" onClick={() => openMail(row, 'email')}>
                              ✉ Send Email
                            </button>
                            <button
                              type="button"
                              className="records-action"
                              disabled={!row.phone}
                              title={row.phone ? `Call ${row.phone}` : 'No phone number on file'}
                              onClick={() => callStudent(row)}
                            >
                              ☏ Call
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === 'consultations' && (
              <section className="records-panel">
                <div className="records-toolbar">
                  <label className="records-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      value={consultSearch}
                      onChange={(event) => setConsultSearch(event.target.value)}
                      placeholder="Search patient or doctor name"
                    />
                  </label>
                  <span className="records-count">{filteredConsultations.length} records</span>
                </div>

                {filteredConsultations.length === 0 ? (
                  <p className="empty-table">
                    {data.consultations.length === 0
                      ? 'No consultation records have been logged yet.'
                      : 'No records match your search.'}
                  </p>
                ) : (
                  <div className="records-table-wrap">
                    <table className="data-table records-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Doctor</th>
                          <th>Appointment</th>
                          <th>Last Updated</th>
                          <th>Patient Note</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConsultations.map((row) => (
                          <tr key={row.appointmentId}>
                            <td>
                              <strong>{row.studentName}</strong>
                              <small className="cell-muted">{row.studentEmail}</small>
                            </td>
                            <td>{row.doctorName}</td>
                            <td>{row.scheduledFor || '—'}</td>
                            <td>{row.updatedAt ? formatStamp(row.updatedAt) : '—'}</td>
                            <td>
                              <span
                                className={`status-pill ${row.patientNoteWritten ? 'status-pill-low' : 'status-pill-grey'}`}
                              >
                                {row.patientNoteWritten ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="records-row-button"
                                onClick={() => setViewingConsultation(row)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {viewing && (
        <div className="records-modal-backdrop" role="presentation" onClick={() => setViewing(null)}>
          <div
            className="records-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Assessment record detail"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="records-modal-head">
              <h2>{viewing.studentName}</h2>
              <button type="button" onClick={() => setViewing(null)} aria-label="Close">
                ×
              </button>
            </div>
            <dl className="records-detail-grid">
              <div>
                <dt>Date</dt>
                <dd>{formatStamp(viewing.createdAt)}</dd>
              </div>
              <div>
                <dt>Assessment</dt>
                <dd>{assessmentNameOf(viewing)}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{viewing.score == null ? '—' : `${viewing.score}/100`}</dd>
              </div>
              <div>
                <dt>Stress Level</dt>
                <dd>
                  <span className={levelPillClass(levelOfResult(viewing))}>{levelOfResult(viewing) ?? '—'}</span>
                </dd>
              </div>
              <div>
                <dt>Survey Score</dt>
                <dd>{viewing.surveyScore == null ? '—' : `${viewing.surveyScore}/100`}</dd>
              </div>
              <div>
                <dt>Heart Rate</dt>
                <dd>{viewing.heartRate == null ? '—' : `${viewing.heartRate} bpm`}</dd>
              </div>
              <div>
                <dt>Emotion</dt>
                <dd>{viewing.emotion ?? '—'}</dd>
              </div>
              <div>
                <dt>Reaction Time</dt>
                <dd>{viewing.reactionTimeMs == null ? '—' : `${viewing.reactionTimeMs} ms`}</dd>
              </div>
              <div>
                <dt>Face Confidence</dt>
                <dd>{viewing.faceConfidence == null ? '—' : `${viewing.faceConfidence}%`}</dd>
              </div>
              <div>
                <dt>Session ID</dt>
                <dd>{viewing.id}</dd>
              </div>
            </dl>
            <div className="records-modal-actions">
              <button type="button" className="records-action primary" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingConsultation && (
        <div
          className="records-modal-backdrop"
          role="presentation"
          onClick={() => setViewingConsultation(null)}
        >
          <div
            className="records-modal wide"
            role="dialog"
            aria-modal="true"
            aria-label="Consultation summary"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="records-modal-head">
              <div>
                <h2>{viewingConsultation.studentName}</h2>
                <p>
                  with {viewingConsultation.doctorName}
                  {viewingConsultation.scheduledFor ? ` · ${viewingConsultation.scheduledFor}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setViewingConsultation(null)} aria-label="Close">
                ×
              </button>
            </div>

            <dl className="records-detail-grid">
              <div>
                <dt>Patient</dt>
                <dd>{viewingConsultation.studentName}</dd>
              </div>
              <div>
                <dt>Doctor</dt>
                <dd>{viewingConsultation.doctorName}</dd>
              </div>
              <div>
                <dt>Appointment</dt>
                <dd>{viewingConsultation.scheduledFor || '—'}</dd>
              </div>
              <div>
                <dt>Last Updated</dt>
                <dd>{viewingConsultation.updatedAt ? formatStamp(viewingConsultation.updatedAt) : '—'}</dd>
              </div>
              <div>
                <dt>Patient Note</dt>
                <dd>
                  {viewingConsultation.patientNoteWritten
                    ? `Written on ${formatDate(viewingConsultation.updatedAt)}`
                    : 'No patient note written'}
                </dd>
              </div>
            </dl>

            <div className="records-modal-actions">
              <button
                type="button"
                className="records-action primary"
                onClick={() => setViewingConsultation(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <div className="records-modal-backdrop" role="presentation" onClick={() => setHistoryFor(null)}>
          <div
            className="records-modal wide"
            role="dialog"
            aria-modal="true"
            aria-label={`${historyFor.name} session history`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="records-modal-head">
              <div>
                <h2>{historyFor.name}</h2>
                <p>
                  {historyFor.studentNo} · {historyFor.sessions} assessment{historyFor.sessions === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" onClick={() => setHistoryFor(null)} aria-label="Close">
                ×
              </button>
            </div>

            {historyLoading && (
              <div className="loading-state">
                <span className="spinner" />
              </div>
            )}
            {!historyLoading && historyError && <div className="records-banner error">{historyError}</div>}
            {!historyLoading && !historyError && historyRows && (
              <>
                {historyRows.length === 0 ? (
                  <p className="empty-table">This patient has not completed any assessments yet.</p>
                ) : (
                  <div className="records-table-wrap">
                    <table className="data-table records-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Assessment</th>
                          <th>Score</th>
                          <th>Level</th>
                          <th>Survey</th>
                          <th>Heart Rate</th>
                          <th>Reaction</th>
                          <th>Emotion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((session) => {
                          const level = session.score != null ? titleCase(bandForScore(session.score)) : session.stressLevel;
                          return (
                            <tr key={session.id}>
                              <td>{formatStamp(session.createdAt)}</td>
                              <td>{assessmentNameOf(session)}</td>
                              <td>{session.score == null ? '—' : `${session.score}/100`}</td>
                              <td>
                                <span className={levelPillClass(level)}>{level ?? '—'}</span>
                              </td>
                              <td>{session.surveyScore == null ? '—' : `${session.surveyScore}/100`}</td>
                              <td>{session.heartRate == null ? '—' : `${session.heartRate} bpm`}</td>
                              <td>{session.reactionTimeMs == null ? '—' : `${session.reactionTimeMs} ms`}</td>
                              <td>{session.emotion ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="records-modal-actions">
              <button type="button" className="records-action primary" onClick={() => setHistoryFor(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
