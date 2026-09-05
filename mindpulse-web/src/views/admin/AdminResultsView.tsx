import React, { useMemo, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';

interface AdminResultsViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'results' | 'analytics' | 'profile') => void;
}

const results = [
  { id: 'SD-2845', patient: 'John Doe', date: '2026-04-04 14:23:15', emotion: 'Calm', confidence: '96.5%', tension: 12, heartRate: '72 bpm', level: 'Low' },
  { id: 'SD-2846', patient: 'Sarah Smith', date: '2026-04-04 13:58:30', emotion: 'Neutral', confidence: '91.8%', tension: 45, heartRate: '82 bpm', level: 'Moderate' },
  { id: 'SD-2847', patient: 'Mike Johnson', date: '2026-04-04 13:41:08', emotion: 'Neutral', confidence: '89.4%', tension: 22, heartRate: '76 bpm', level: 'Low' },
  { id: 'SD-2848', patient: 'Emma Wilson', date: '2026-04-04 12:35:44', emotion: 'Anxious', confidence: '78.2%', tension: 68, heartRate: '94 bpm', level: 'High' },
];

export const AdminResultsView: React.FC<AdminResultsViewProps> = ({ onSignOut, onNavigate }) => {
  const [level, setLevel] = useState('All Levels');
  const [emotion, setEmotion] = useState('All Emotions');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(2026, 8, 1));
  const filteredResults = useMemo(() => results.filter((result) =>
    (level === 'All Levels' || result.level === level.replace('Moderate', 'Moderate')) &&
    (emotion === 'All Emotions' || result.emotion === emotion) &&
    (!selectedDate || result.date.startsWith(selectedDate)) &&
    `${result.id} ${result.patient}`.toLowerCase().includes(search.toLowerCase()),
  ), [level, emotion, search, selectedDate]);

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

  return <div className="doctor-shell">
    <AdminSidebar onSignOut={onSignOut} activeView="results" onNavigate={onNavigate} />
    <main className="main-panel detection-results-main">
      <header className="topbar detection-results-topbar"><div><h1>Detection Results</h1><p className="page-subtitle">View and analyze stress detection scan results</p></div><div className="header-actions"><button type="button" className="ghost-button">⌕ Filter</button><button type="button" className="ghost-button">⇩ Export</button><button type="button" className="notification-button" aria-label="Notifications"><NotificationBell /></button></div></header>
      <section className="detection-summary-grid"><Summary label="Total Scans Today" value="2,847" change="+12.5% from yesterday" tone="green" /><Summary label="Avg Confidence" value="1,243" change="+2.1% from yesterday" tone="green" /><Summary label="High Stress Count" value="47" change="-15.3% from yesterday" tone="red" /><Summary label="Anomalies Detected" value="3" change="Requires review" tone="neutral" /></section>
      <section className="detection-filter-bar"><label className="detection-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users name or ID" /></label><select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filter stress level"><option>All Levels</option><option>Low</option><option>Moderate</option><option>High</option></select><select value={emotion} onChange={(event) => setEmotion(event.target.value)} aria-label="Filter emotion"><option>All Emotions</option><option>Calm</option><option>Neutral</option><option>Anxious</option><option>Stressed</option></select><div className="date-filter-wrap"><button type="button" className="date-filter" onClick={() => setCalendarOpen((open) => !open)}>▣ {selectedDate || 'Today'}</button>{calendarOpen && <div className="calendar-popover" role="dialog" aria-label="Choose scan date"><div className="calendar-header"><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Previous month">‹</button><strong>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Next month">›</button></div><div className="calendar-weekdays">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map((item, index) => <button type="button" key={`${item.date}-${index}`} className={`${item.currentMonth ? '' : 'outside-month'} ${selectedDate === item.date ? 'selected-day' : ''}`} onClick={() => selectDate(item.date)} disabled={!item.currentMonth}>{item.day}</button>)}</div><div className="calendar-footer"><button type="button" onClick={() => { setSelectedDate(''); setCalendarOpen(false); }}>Clear</button><button type="button" onClick={() => { setSelectedDate('2026-09-03'); setCalendarOpen(false); }}>Today</button></div></div>}</div></section>
      <section className="detection-results-panel"><h2>Recent Scans</h2><div className="scan-list">{filteredResults.map((result) => <article className="scan-row" key={result.id}><div className="scan-identity"><span className="scan-label">Scan ID</span><strong>{result.id}</strong><div className="scan-user"><span className="account-avatar">●</span><span><b>{result.patient}</b><small>{result.date}</small></span></div></div><div className="scan-detail"><span>Emotion</span><b className="emotion-badge">{result.emotion}</b><span>Stress Level</span><b className={`stress-text ${result.level.toLowerCase()}`}>{result.level}</b></div><div className="scan-detail"><span>Confidence</span><strong>{result.confidence}</strong><span>Heart Rate</span><strong>{result.heartRate}</strong></div><div className="tension-detail"><span>Facial Tension <small>{result.tension}%</small></span><div className="tension-track"><i style={{ width: `${result.tension}%` }} className={result.tension > 50 ? 'high' : ''} /></div></div><button type="button" className="view-details-button">View Details</button></article>)}</div>{filteredResults.length === 0 && <p className="empty-table">No scans match your filters.</p>}</section>
    </main>
  </div>;
};

const Summary: React.FC<{ label: string; value: string; change: string; tone: 'green' | 'red' | 'neutral' }> = ({ label, value, change, tone }) => <article className={`detection-summary-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{change}</small></article>;
