import React, { useState } from 'react';
import { StudentCase } from './StudentCasesView';
import './StudentCaseDetailView.css';

interface StudentCaseDetailViewProps {
  onBack: () => void;
  student: StudentCase;
}

type DetailTab = 'Overview' | 'Assessment Results' | 'Consultations' | 'Add Notes';

export const StudentCaseDetailView: React.FC<StudentCaseDetailViewProps> = ({ onBack, student }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [saved, setSaved] = useState(false);

  return (
    <main className="main-panel student-detail-main">
      <header className="student-detail-topbar"><strong>Student Cases</strong><button type="button" className="notification-button" aria-label="Notifications">🔔</button></header>
      <button type="button" className="back-to-cases" onClick={onBack}>← Back to Cases</button>
      <section className="student-profile-card">
        <div className="student-profile-heading"><div className="student-initials">{student.initials}</div><div><h1>{student.name}</h1><span>{student.id}</span><p>♙ {student.age} years, Female&nbsp;&nbsp; · &nbsp;&nbsp;▣ {student.program}&nbsp;&nbsp; · &nbsp;&nbsp;▦ 3rd Year</p></div><div className="student-risk"><span>{student.status}</span><strong>{student.score}%</strong><small>Current Stress Level</small></div></div>
        <div className="student-contact-row"><span>✉ sarah.johnson@university.edu</span><span>⌕ +1 (555) 123-4567</span><span>⌖ 123 Campus Drive, University City</span></div>
      </section>
      <nav className="student-detail-tabs" aria-label="Student case sections">{(['Overview', 'Assessment Results', 'Consultations', 'Add Notes'] as DetailTab[]).map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => { setActiveTab(tab); setSaved(false); }}>{tab}</button>)}</nav>
      {activeTab === 'Overview' && <div className="student-detail-content"><div className="detail-stat-grid"><DetailStat label="Assigned Date" value="Jan 15, 2026" /><DetailStat label="Consultations" value="5" /><DetailStat label="Last Contact" value="2 hours ago" /><DetailStat label="Trend" value="Increasing" danger /></div><div className="detail-panels"><section className="detail-panel"><h2>Stress Trend (7 Weeks)</h2><div className="trend-chart"><span className="chart-y-label top">100</span><span className="chart-y-label middle">75</span><span className="chart-y-label lower">50</span><span className="chart-y-label bottom">25</span><svg viewBox="0 0 500 170" preserveAspectRatio="none" aria-label="Stress trend increasing over seven weeks" role="img"><path d="M0 145 L83 126 L166 108 L249 88 L332 67 L415 45 L500 24" /><circle cx="0" cy="145" r="3" /><circle cx="83" cy="126" r="3" /><circle cx="166" cy="108" r="3" /><circle cx="249" cy="88" r="3" /><circle cx="332" cy="67" r="3" /><circle cx="415" cy="45" r="3" /><circle cx="500" cy="24" r="3" /></svg><div className="chart-x-labels">{['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'].map((week) => <span key={week}>{week}</span>)}</div></div></section><section className="detail-panel"><h2>Risk Indicators</h2><RiskIndicator label="Academic Stress" level="High" value="88%" /><RiskIndicator label="Social Anxiety" level="Moderate" value="61%" /><RiskIndicator label="Sleep Quality" level="Low" value="24%" /><RiskIndicator label="Emotional Well-being" level="Poor" value="22%" /></section></div></div>}
      {activeTab === 'Assessment Results' && <div className="student-detail-content"><section className="detail-assessment-card"><div><h2>Facial Analysis <span className="risk-badge critical">Critical</span></h2><p>Apr 8, 2026 · 2:30 PM</p></div><strong>85%<small>Stress Level</small></strong><div className="detail-emotion-bars"><Emotion label="Anxiety" value="78%" color="red" /><Emotion label="Sadness" value="65%" color="blue" /><Emotion label="Neutral" value="20%" color="green" /></div><footer>◷ Duration: 15 min</footer></section></div>}
      {activeTab === 'Consultations' && <div className="student-detail-content"><section className="detail-panel consultation-detail"><h2>Follow-up <span className="status-pill-green">Completed</span></h2><small>Apr 5, 2026</small><h3>Notes:</h3><p>Student expressed concerns about upcoming exams. Recommended stress management techniques.</p><h3>Recommendations:</h3><p>Continue weekly sessions, practice mindfulness exercises.</p></section></div>}
      {activeTab === 'Add Notes' && <div className="student-detail-content"><section className="detail-panel notes-detail"><h2>Add Consultation Notes &amp; Recommendations</h2><label htmlFor="consultation-notes">Consultation Notes</label><textarea id="consultation-notes" placeholder="Enter detailed consultation notes here..." /><label htmlFor="recommendation-notes">Recommendations</label><textarea id="recommendation-notes" placeholder="Enter recommendations and action items..." /><div><button type="button" className="primary-button" onClick={() => setSaved(true)}>Save Consultation</button><button type="button" className="ghost-button">Clear</button>{saved && <span className="save-confirmation">Saved</span>}</div></section></div>}
    </main>
  );
};

const DetailStat: React.FC<{ label: string; value: string; danger?: boolean }> = ({ label, value, danger }) => <article className="detail-stat"><span>{label}</span><strong className={danger ? 'danger-text' : ''}>{value}</strong></article>;
const RiskIndicator: React.FC<{ label: string; level: string; value: string }> = ({ label, level, value }) => <div className="risk-indicator"><div><span>{label}</span><b>{level}</b></div><i style={{ width: value }} /></div>;
const Emotion: React.FC<{ label: string; value: string; color: 'red' | 'blue' | 'green' }> = ({ label, value, color }) => <div className="detail-emotion"><div><span>{label}</span><b>{value}</b></div><i className={color} style={{ width: value }} /></div>;
