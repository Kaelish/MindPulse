import React, { useMemo, useState } from 'react';

type Result = { id: string; patient: string; date: string; score: number; level: 'Critical' | 'High' | 'Moderate'; anxiety: number; sadness: number; neutral: number };

const results: Result[] = [
  { id: 'SD-2845', patient: 'John Doe', date: '2026-04-01 14:23:15', score: 85, level: 'Critical', anxiety: 78, sadness: 65, neutral: 20 },
  { id: 'SD-2845', patient: 'John Doe', date: '2026-04-01 14:23:15', score: 85, level: 'High', anxiety: 72, sadness: 58, neutral: 25 },
  { id: 'SD-2846', patient: 'Sarah Smith', date: '2026-04-01 13:58:30', score: 61, level: 'Moderate', anxiety: 52, sadness: 34, neutral: 41 },
];

export const AssessmentResultsView: React.FC<{ onViewFullCase?: () => void }> = ({ onViewFullCase }) => {
  const [level, setLevel] = useState('All Levels');
  const [emotion, setEmotion] = useState('All Emotions');
  const [search, setSearch] = useState('');
  const [reviewed, setReviewed] = useState([] as string[]);
  const visibleResults = useMemo(() => results.filter((result) => (level === 'All Levels' || result.level === level) && (emotion === 'All Emotions' || (emotion === 'Anxiety' ? result.anxiety > 0 : emotion === 'Sadness' ? result.sadness > 0 : result.neutral > 0)) && `${result.id} ${result.patient}`.toLowerCase().includes(search.toLowerCase())), [level, emotion, search]);
  const toggleReviewed = (id: string) => setReviewed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <main className="main-panel assessment-results-main">
    <header className="topbar assessment-results-topbar"><div><h1>Assessment Results</h1><p className="page-subtitle">Review and analyze student stress assessment results</p></div><div className="header-actions"><button type="button" className="ghost-button">⌕ Filter</button><button type="button" className="ghost-button">⇩ Export</button><button type="button" className="notification-button" aria-label="Notifications">🔔</button></div></header>
    <section className="assessment-summary-grid"><Summary label="Total Assessments" value="5" change="+12.5% from yesterday" tone="green" /><Summary label="Pending Review" value="2" change="+2.1% from yesterday" tone="green" /><Summary label="High Risk" value="4" change="-15.3% from yesterday" tone="red" /><Summary label="Avg Stress Level" value="67%" change="" tone="neutral" /></section>
    <section className="assessment-filter-bar"><label className="assessment-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users name or ID" /></label><select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filter assessment level"><option>All Levels</option><option>Critical</option><option>High</option><option>Moderate</option></select><select value={emotion} onChange={(event) => setEmotion(event.target.value)} aria-label="Filter assessment emotion"><option>All Emotions</option><option>Anxiety</option><option>Sadness</option><option>Neutral</option></select><button type="button" className="date-filter">▣ Today</button></section>
    <section className="assessment-list-panel"><div className="assessment-list">{visibleResults.map((result, index) => { const key = `${result.id}-${index}`; const isReviewed = reviewed.includes(key); return <article className="assessment-card" key={key}><div className="assessment-card-header"><div className="assessment-student"><span className="account-avatar">●</span><div><span className="scan-label">{result.patient}</span><strong>{result.id}</strong><small>{result.date}</small></div></div><div className="assessment-score"><strong>{result.score}%</strong><span className={`risk-badge ${result.level.toLowerCase()}`}>{result.level}</span></div><button type="button" className="view-case-button" onClick={onViewFullCase}>View Full Case</button></div><div className="emotion-analysis"><span className="analysis-label">Emotional<br />Analysis:</span><EmotionBar label="Anxiety" value={result.anxiety} color="blue" /><EmotionBar label="Sadness" value={result.sadness} color="cyan" /><EmotionBar label="Neutral" value={result.neutral} color="green" /></div><button type="button" className={`review-button ${isReviewed ? 'reviewed' : ''}`} onClick={() => toggleReviewed(key)}>{isReviewed ? 'Reviewed' : 'Mark as Reviewed'}</button></article>; })}</div>{visibleResults.length === 0 && <p className="empty-table">No assessment results match your filters.</p>}</section>
  </main>;
};

const Summary: React.FC<{ label: string; value: string; change: string; tone: 'green' | 'red' | 'neutral' }> = ({ label, value, change, tone }) => <article className={`assessment-summary-card ${tone}`}><span>{label}</span><strong>{value}</strong>{change && <small>{change}</small>}</article>;
const EmotionBar: React.FC<{ label: string; value: number; color: 'blue' | 'cyan' | 'green' }> = ({ label, value, color }) => <div className="emotion-bar"><div><span>{label}</span><b>{value}%</b></div><i className={color} style={{ width: `${value}%` }} /></div>;
