import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StudentCase } from './StudentCasesView';
<<<<<<< HEAD
import { DoctorEmpty, DoctorError, DoctorLoading, DoctorNotifications } from '../../components/doctor/DoctorChrome';
=======
import { DoctorNotificationMenu } from '../../components/DoctorNotificationMenu';
>>>>>>> ce566a6076c4bcd63c885297ca60078416fc1544
import './StudentCaseDetailView.css';
import {
  fetchStudentConsultations,
  fetchStudentSessions,
  StudentAppointmentRecord,
  StudentSessionRecord,
} from '../../services/studentCases';
import { createRecommendation } from '../../services/recommendations';
import { bandForScore } from '../../services/admin';
import type { RecommendationPriority } from '../../types/supabase';

interface StudentCaseDetailViewProps {
  onBack: () => void;
  student: StudentCase;
}

type DetailTab = 'Overview' | 'Assessment Results' | 'Consultations' | 'Add Recommendation';

const CATEGORIES = ['General', 'Therapy', 'Academic', 'Lifestyle', 'Wellness'];
const PRIORITIES: RecommendationPriority[] = ['Low', 'Medium', 'High'];

const bandLabel = (score: number) => {
  const band = bandForScore(score);
  return band === 'high' ? 'High' : band === 'moderate' ? 'Moderate' : 'Low';
};

const formatDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export const StudentCaseDetailView: React.FC<StudentCaseDetailViewProps> = ({ onBack, student }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [saved, setSaved] = useState(false);
  const [sessions, setSessions] = useState<StudentSessionRecord[]>([]);
  const [consultations, setConsultations] = useState<StudentAppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<RecommendationPriority>('Medium');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    Promise.all([fetchStudentSessions(student.userId), fetchStudentConsultations(student.userId)])
      .then(([sessionRows, consultationRows]) => {
        if (!active) return;
        setSessions(sessionRows);
        setConsultations(consultationRows);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load this student case.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [student.userId, reloadKey]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const contactTimes = useMemo(() => {
    const times: number[] = [];
    consultations.forEach((consultation) => {
      const at = new Date(consultation.createdAt).getTime();
      if (!Number.isNaN(at)) times.push(at);
    });
    sessions.forEach((session) => {
      const at = new Date(session.createdAt).getTime();
      if (!Number.isNaN(at)) times.push(at);
    });
    return times;
  }, [consultations, sessions]);

  const assignedDate = contactTimes.length ? formatDate(new Date(Math.min(...contactTimes))) : '—';
  const lastContact = contactTimes.length ? formatDate(new Date(Math.max(...contactTimes))) : 'No contact yet';

  const trendPoints = useMemo(() => {
    const scored = sessions.filter((session) => session.score != null).slice(0, 7).reverse();
    return scored.map((session, index, list) => {
      const score = session.score ?? 0;
      return {
        id: session.id,
        label: new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        x: list.length > 1 ? (index * 500) / (list.length - 1) : 0,
        y: 170 - (score / 100) * 150,
      };
    });
  }, [sessions]);

  const trendPath = trendPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');

  const latestSession = sessions[0];

  const statusText = (student.status || '').toLowerCase();
  const riskTone = statusText.includes('high')
    ? 'critical'
    : statusText.includes('moderate')
      ? 'watch'
      : statusText.includes('unassessed')
        ? 'neutral'
        : 'low';
  const scoreTone = latestSession && latestSession.score != null
    ? (bandForScore(latestSession.score) === 'low' ? 'good' : bandForScore(latestSession.score) === 'moderate' ? 'warn' : 'bad')
    : 'neutral';
  const heartTone = !latestSession || latestSession.heartRate == null
    ? 'neutral'
    : latestSession.heartRate >= 60 && latestSession.heartRate <= 100 ? 'good' : 'bad';
  const reactionTone = !latestSession || latestSession.reactionTimeMs == null
    ? 'neutral'
    : latestSession.reactionTimeMs <= 1500 ? 'good' : 'bad';

  const saveRecommendation = async () => {
    if (!note.trim()) {
      setSaveError('Enter a recommendation before saving.');
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      await createRecommendation({ studentId: student.userId, category, priority, note: note.trim() });
      setNote('');
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the recommendation.');
    } finally {
      setIsSaving(false);
    }
  };

  const clearForm = () => {
    setCategory('General');
    setPriority('Medium');
    setNote('');
    setSaved(false);
    setSaveError('');
  };

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <main className="main-panel student-detail-main">
<<<<<<< HEAD
      <header className="student-detail-topbar"><strong>Student Cases</strong><DoctorNotifications /></header>
=======
      <header className="student-detail-topbar"><strong>Student Cases</strong><DoctorNotificationMenu /></header>
>>>>>>> ce566a6076c4bcd63c885297ca60078416fc1544
      <button type="button" className="back-to-cases" onClick={onBack}>← Back to Cases</button>
      <section className="student-profile-card">
        <div className="student-profile-heading"><div className="student-initials">{student.initials}</div><div><h1>{student.name}</h1><span>{student.id}</span><p>{student.age || '—'} years, {student.sex}&nbsp;&nbsp; · &nbsp;&nbsp;{student.program}&nbsp;&nbsp; · &nbsp;&nbsp;{student.year}</p></div><div className={`student-risk tone-${riskTone}`}><span>{student.status}</span><strong>{student.score}%</strong><small>Current Stress Level</small></div></div>
        <div className="student-contact-row"><span>{student.email}</span><span>{student.phone}</span><span>{student.location}</span></div>
      </section>
      <nav className="student-detail-tabs" aria-label="Student case sections">{(['Overview', 'Assessment Results', 'Consultations', 'Add Recommendation'] as DetailTab[]).map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => { setActiveTab(tab); setSaved(false); }}>{tab}</button>)}</nav>
      {isLoading && <DoctorLoading label="Loading case data…" />}
      {!isLoading && loadError && <DoctorError message={loadError} onRetry={retry} />}
      {!isLoading && !loadError && <>
        {activeTab === 'Overview' && <div className="student-detail-content">
          <div className="detail-stat-grid">
            <DetailStat label="Assigned Date" value={assignedDate} />
            <DetailStat label="Consultations" value={String(consultations.length)} />
            <DetailStat label="Last Contact" value={lastContact} />
            <DetailStat label="Trend" value={student.trend} danger={student.trend === 'Increasing'} />
          </div>
          <div className="detail-panels">
            <section className="detail-panel">
              <h2>Stress Trend (Last 7 Assessments)</h2>
              {trendPoints.length === 0 ? (
                <p className="empty-table">No assessment sessions yet.</p>
              ) : (
                <div className="trend-chart">
                  <span className="chart-y-label top">100</span>
                  <span className="chart-y-label middle">75</span>
                  <span className="chart-y-label lower">50</span>
                  <span className="chart-y-label bottom">25</span>
                  <svg viewBox="0 0 500 170" preserveAspectRatio="none" aria-label={`Stress trend across ${trendPoints.length} assessments`} role="img">
                    <path d={trendPath} />
                    {trendPoints.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r={3} />)}
                  </svg>
                  <div className="chart-x-labels">{trendPoints.map((point) => <span key={point.id}>{point.label}</span>)}</div>
                </div>
              )}
            </section>
            <section className="detail-panel">
              <h2>Risk Indicators</h2>
              {!latestSession ? (
                <p className="empty-table">No assessment yet</p>
              ) : (
                <>
                  <RiskIndicator
                    label="Overall score"
                    tone={scoreTone}
                    level={latestSession.score == null ? 'No score' : `${latestSession.score}% · ${bandLabel(latestSession.score)}`}
                    value={latestSession.score == null ? '0%' : `${clampPercent(latestSession.score)}%`}
                  />
                  <RiskIndicator
                    label="Heart rate"
                    tone={heartTone}
                    level={latestSession.heartRate == null ? '—' : `${latestSession.heartRate} bpm · ${latestSession.heartRate >= 60 && latestSession.heartRate <= 100 ? 'in 60–100 range' : 'outside 60–100'}`}
                    value={`${latestSession.heartRate == null ? 0 : clampPercent(latestSession.heartRate)}%`}
                  />
                  <RiskIndicator
                    label="Survey score"
                    tone="neutral"
                    level={latestSession.surveyScore == null ? '—' : String(latestSession.surveyScore)}
                    value={`${latestSession.surveyScore == null ? 0 : clampPercent(latestSession.surveyScore)}%`}
                  />
                  <RiskIndicator
                    label="Reaction time"
                    tone={reactionTone}
                    level={latestSession.reactionTimeMs == null ? '—' : `${latestSession.reactionTimeMs} ms · ${latestSession.reactionTimeMs <= 1500 ? 'within 1500 ms' : 'over 1500 ms'}`}
                    value={`${latestSession.reactionTimeMs == null ? 0 : clampPercent(latestSession.reactionTimeMs / 30)}%`}
                  />
                </>
              )}
            </section>
          </div>
        </div>}
        {activeTab === 'Assessment Results' && <div className="student-detail-content">
          {sessions.length === 0 && <DoctorEmpty title="No assessment results yet" description="Completed stress assessments for this student will be listed here." />}
          {sessions.map((session) => {
            const band = session.score == null ? null : bandForScore(session.score);
            const riskLabel = session.stressLevel ?? (session.score == null ? '—' : bandLabel(session.score));
            const riskClass = (session.stressLevel ?? band ?? '').toLowerCase();
            return (
              <section className="detail-assessment-card" key={session.id}>
                <div><h2>Assessment <span className={`risk-badge ${riskClass}`}>{riskLabel}</span></h2><p>{formatDateTime(session.createdAt)}</p></div>
                <strong className={band ? `score-${band}` : ''}>{session.score == null ? '—' : `${session.score}%`}<small>Stress Level</small></strong>
                <div className="detail-emotion-bars">
                  <SessionMetric label="Heart rate" value={session.heartRate == null ? '—' : `${session.heartRate} bpm`} />
                  <SessionMetric label="Survey score" value={session.surveyScore == null ? '—' : String(session.surveyScore)} />
                  <SessionMetric label="Reaction time" value={session.reactionTimeMs == null ? '—' : `${session.reactionTimeMs} ms`} />
                </div>
                <footer>Emotion: {session.emotion ?? '—'}{session.notes ? ` · ${session.notes}` : ''}</footer>
              </section>
            );
          })}
        </div>}
        {activeTab === 'Consultations' && <div className="student-detail-content">
          {consultations.length === 0 && <DoctorEmpty title="No consultations booked yet" description="Booked sessions with this student will appear here with their status and notes." />}
          {consultations.map((consultation) => {
            const statusLabel = consultation.status ? consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1) : 'Scheduled';
            const pillClass = consultation.status === 'completed'
              ? 'status-pill-green'
              : consultation.status === 'cancelled'
                ? 'status-pill status-critical'
                : 'status-pill status-confirmed';
            return (
              <section className="detail-panel consultation-detail" key={consultation.id}>
                <h2>Consultation <span className={pillClass}>{statusLabel}</span></h2>
                <small>{consultation.scheduledFor || formatDateTime(consultation.createdAt)}</small>
                {consultation.notes && (<><h3>Notes:</h3><p>{consultation.notes}</p></>)}
              </section>
            );
          })}
        </div>}
        {activeTab === 'Add Recommendation' && <div className="student-detail-content">
          <section className="detail-panel notes-detail">
            <h2>Add Recommendation</h2>
            <label htmlFor="recommendation-category">Category</label>
            <select id="recommendation-category" value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select>
            <label htmlFor="recommendation-priority">Priority</label>
            <select id="recommendation-priority" value={priority} onChange={(event) => setPriority(event.target.value as RecommendationPriority)}>{PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select>
            <label htmlFor="recommendation-note">Recommendation</label>
            <textarea id="recommendation-note" placeholder="Enter recommendations and action items..." value={note} onChange={(event) => setNote(event.target.value)} />
            <div>
              <button type="button" className="primary-button" disabled={isSaving} onClick={saveRecommendation}>{isSaving ? 'Saving…' : 'Save Recommendation'}</button>
              <button type="button" className="ghost-button" onClick={clearForm}>Clear</button>
              {saved && <span className="save-confirmation">Saved</span>}
            </div>
            {saveError && <p className="case-load-error is-error" role="alert">{saveError}</p>}
          </section>
        </div>}
      </>}
    </main>
  );
};

const DetailStat: React.FC<{ label: string; value: string; danger?: boolean }> = ({ label, value, danger }) => <article className="detail-stat"><span>{label}</span><strong className={danger ? 'danger-text' : ''}>{value}</strong></article>;
const RiskIndicator: React.FC<{ label: string; level: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }> = ({ label, level, value, tone = 'neutral' }) => <div className={`risk-indicator tone-${tone}`}><div><span>{label}</span><b>{level}</b></div><i style={{ width: value }} /></div>;
const SessionMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="detail-emotion"><div><span>{label}</span><b>{value}</b></div></div>;
