import React, { useEffect, useMemo, useState } from 'react';
import { AdminNavView, AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { AdminResultRow, assessmentNameOf, bandForScore, fetchAdminResults } from '../../services/admin';

interface AdminResultsViewProps {
  onSignOut: () => void;
  onNavigate: (view: AdminNavView) => void;
}

const pad = (value: number) => String(value).padStart(2, '0');

const localDateKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const bandOf = (row: AdminResultRow) => (row.score != null ? bandForScore(row.score) : null);

export const AdminResultsView: React.FC<AdminResultsViewProps> = ({ onSignOut, onNavigate }) => {
  const [rows, setRows] = useState<AdminResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [level, setLevel] = useState('All Levels');
  const [emotion, setEmotion] = useState('All Emotions');
  const [assessmentKind, setAssessmentKind] = useState('All Types');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchAdminResults()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load detection results.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const emotionOptions = useMemo(() => Array.from(
    new Set(rows.map((row) => row.emotion).filter((value): value is string => Boolean(value))),
  ).sort(), [rows]);

  const filteredResults = useMemo(() => rows.filter((row) => {
    if (level !== 'All Levels' && bandOf(row) !== level.toLowerCase()) return false;
    if (emotion !== 'All Emotions' && row.emotion !== emotion) return false;
    if (assessmentKind !== 'All Types' && row.assessmentType !== assessmentKind.toLowerCase()) return false;
    if (selectedDate && localDateKey(row.createdAt) !== selectedDate) return false;
    const term = search.toLowerCase();
    if (term && !`${row.studentName} ${row.id.slice(0, 8)}`.toLowerCase().includes(term)) return false;
    return true;
  }), [rows, level, emotion, assessmentKind, search, selectedDate]);

  const scored = rows.filter((row) => row.score != null);
  const averageScore = scored.length
    ? Math.round(scored.reduce((total, row) => total + (row.score ?? 0), 0) / scored.length)
    : null;
  const scansToday = rows.filter((row) => localDateKey(row.createdAt) === todayKey()).length;
  // High Stress Count is a triage/status metric — daily assessments only.
  const highStress = rows.filter((row) => row.assessmentType === 'daily' && bandOf(row) === 'high').length;

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const previousMonthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - firstDay + 1;
      if (dayNumber < 1) return { day: previousMonthDays + dayNumber, currentMonth: false, date: '' };
      if (dayNumber > daysInMonth) return { day: dayNumber - daysInMonth, currentMonth: false, date: '' };
      const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
      const day = String(dayNumber).padStart(2, '0');
      return { day: dayNumber, currentMonth: true, date: `${calendarMonth.getFullYear()}-${month}-${day}` };
    });
  }, [calendarMonth]);

  const selectDate = (date: string) => {
    if (!date) return;
    setSelectedDate(date);
    setCalendarOpen(false);
  };

  return <div className="doctor-shell admin-scope">
    <AdminSidebar onSignOut={onSignOut} activeView="results" onNavigate={onNavigate} />
    <main className="main-panel detection-results-main">
      <header className="topbar detection-results-topbar"><div><h1>Detection Results</h1><p className="page-subtitle">View and analyze stress detection scan results</p></div><div className="header-actions"><div className="account-actions"><button type="button" className="notification-button" aria-label="Notifications" onClick={() => setShowNotifications((open) => !open)}><NotificationBell /></button>{showNotifications && <NotificationPanel />}</div></div></header>
      <section className="detection-summary-grid">
        <Summary label="Total Scans" value={String(rows.length)} change="All recorded sessions" tone="neutral" />
        <Summary label="Scans Today" value={String(scansToday)} change="Local calendar date" tone="green" />
        <Summary label="Average Score" value={averageScore != null ? String(averageScore) : '—'} change="Scans with a recorded score" tone="neutral" />
        <Summary label="High Stress Count" value={String(highStress)} change="Score above 60" tone="red" />
      </section>
      <section className="detection-filter-bar"><label className="detection-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users name or ID" /></label><select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filter stress level"><option>All Levels</option><option>Low</option><option>Moderate</option><option>High</option></select><select value={emotion} onChange={(event) => setEmotion(event.target.value)} aria-label="Filter emotion"><option>All Emotions</option>{emotionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={assessmentKind} onChange={(event) => setAssessmentKind(event.target.value)} aria-label="Filter assessment type"><option>All Types</option><option>Daily</option><option>Supplementary</option></select><div className="date-filter-wrap"><button type="button" className="date-filter" onClick={() => setCalendarOpen((open) => !open)}>▣ {selectedDate || 'All dates'}</button>{calendarOpen && <div className="calendar-popover" role="dialog" aria-label="Choose scan date"><div className="calendar-header"><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Previous month">‹</button><strong>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Next month">›</button></div><div className="calendar-weekdays">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map((item, index) => <button type="button" key={`${item.date}-${index}`} className={`${item.currentMonth ? '' : 'outside-month'} ${selectedDate === item.date ? 'selected-day' : ''}`} onClick={() => selectDate(item.date)} disabled={!item.currentMonth}>{item.day}</button>)}</div><div className="calendar-footer"><button type="button" onClick={() => { setSelectedDate(''); setCalendarOpen(false); }}>Clear</button><button type="button" onClick={() => { setSelectedDate(todayKey()); setCalendarOpen(false); }}>Today</button></div></div>}</div></section>
      <section className="detection-results-panel"><h2>Recent Scans</h2>
        {isLoading && <div className="loading-state"><span className="spinner" /></div>}
        {loadError && <div className="error-state"><p>{loadError}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button></div>}
        {!isLoading && !loadError && <>
          <div className="scan-list">{filteredResults.map((result) => {
            const band = bandOf(result);
            const levelText = band ? titleCase(band) : (result.stressLevel ?? '—');
            return (
              <article className="scan-row" key={result.id}>
                <div className="scan-identity"><span className="scan-label">Scan ID</span><strong>{result.id.slice(0, 8)}</strong><div className="scan-user">{result.avatarUrl
                  ? <img className="account-avatar account-avatar-img" src={result.avatarUrl} alt="" />
                  : <span className="account-avatar">{result.studentName.trim().charAt(0).toUpperCase()}</span>}<span><b>{result.studentName}</b><small>{formatStamp(result.createdAt)}</small><small>{assessmentNameOf(result)}</small><small className="type-chip">{result.assessmentType ? result.assessmentType.charAt(0).toUpperCase() + result.assessmentType.slice(1) : 'Daily'}</small></span></div></div>
                <div className="scan-detail"><span>Emotion</span><b className="emotion-badge">{result.emotion ?? '—'}</b><span>Stress Level</span><b className={`stress-text ${levelText.toLowerCase()}`}>{band && result.score != null ? `${levelText} (${result.score})` : levelText}</b></div>
                <div className="scan-detail"><span>Heart Rate</span><strong>{result.heartRate != null ? `${result.heartRate} bpm` : '— bpm'}</strong><span>Survey Score</span><strong>{result.surveyScore ?? '—'}</strong></div>
                <div className="tension-detail"><span>Reaction Time</span><strong>{result.reactionTimeMs != null ? `${result.reactionTimeMs} ms` : '—'}</strong></div>
              </article>
            );
          })}</div>
          {filteredResults.length === 0 && <p className="empty-table">{rows.length === 0 ? 'No scans recorded yet.' : 'No scans match your filters.'}</p>}
        </>}
      </section>
    </main>
  </div>;
};

const Summary: React.FC<{ label: string; value: string; change: string; tone: 'green' | 'red' | 'neutral' }> = ({ label, value, change, tone }) => <article className={`detection-summary-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{change}</small></article>;
