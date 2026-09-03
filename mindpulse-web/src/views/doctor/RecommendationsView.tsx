import React, { FormEvent, useMemo, useState } from 'react';

type RecommendationStatus = 'Active' | 'Pending' | 'Completed';
type Recommendation = { id: number; student: string; studentId: string; category: string; priority: string; text: string; date: string; status: RecommendationStatus };

const initialRecommendations: Recommendation[] = [
  { id: 1, student: 'Mike Johnson', studentId: '1', category: 'Therapy', priority: 'High Priority', text: 'Weekly cognitive behavioral therapy sessions for stress management', date: '2026-04-15', status: 'Active' },
  { id: 2, student: 'Emma Davis', studentId: '2', category: 'Academic', priority: 'Low Priority', text: 'Consider consultation with psychiatrist for anxiety medication evaluation', date: '2026-04-10', status: 'Completed' },
];

export const RecommendationsView: React.FC = () => {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [activeFilter, setActiveFilter] = useState<'All' | RecommendationStatus>('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const visibleRecommendations = useMemo(() => activeFilter === 'All' ? recommendations : recommendations.filter((item) => item.status === activeFilter), [activeFilter, recommendations]);

  const saveRecommendation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated: Recommendation = { id: editingId ?? Date.now(), student: String(form.get('student')), studentId: String(form.get('studentId')), category: String(form.get('category')), priority: String(form.get('priority')), text: String(form.get('text')), date: '2026-04-15', status: 'Active' };
    setRecommendations((current) => editingId ? current.map((item) => item.id === editingId ? updated : item) : [...current, updated]);
    setShowForm(false); setEditingId(null); setSaved(true);
  };

  const markComplete = (id: number) => setRecommendations((current) => current.map((item) => item.id === id ? { ...item, status: 'Completed' } : item));

  return <main className="main-panel recommendations-main">
    <header className="topbar recommendations-topbar"><div><h1>Give Recommendations</h1><p className="page-subtitle">Create and manage student recommendations and action plans</p></div><button type="button" className="notification-button" aria-label="Notifications">🔔</button></header>
    <div className="recommendations-toolbar"><div className="recommendation-filters">{(['All', 'Active', 'Pending', 'Completed'] as const).map((filter) => <button type="button" key={filter} className={activeFilter === filter ? 'active' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div><button type="button" className="add-recommendation-button" onClick={() => { setEditingId(null); setSaved(false); setShowForm(true); }}>＋ Add Recommendations</button></div>
    {saved && <div className="recommendation-save-banner">Recommendation saved successfully.</div>}
    <section className="recommendation-list">{visibleRecommendations.map((item) => <article className="recommendation-card" key={item.id}><div className="recommendation-card-content"><div className="recommendation-title-row"><h2>{item.student}</h2><span className="recommendation-category">{item.category}</span><span className={`recommendation-priority ${item.priority === 'High Priority' ? 'high' : 'low'}`}>{item.priority}</span></div><p>{item.text}</p><div className="recommendation-meta"><span>◷ Created: {item.date}</span><span className={item.status === 'Completed' ? 'recommendation-completed' : ''}>◉ {item.status}</span></div><div className="recommendation-actions">{item.status !== 'Completed' && <button type="button" className="complete-recommendation" onClick={() => markComplete(item.id)}>Mark as Completed</button>}<button type="button" className="edit-recommendation" onClick={() => { setEditingId(item.id); setSaved(false); setShowForm(true); }}>Edit</button></div></div><div className="recommendation-student-id"><span>Student ID</span><strong>{item.studentId}</strong></div></article>)}</section>
    {visibleRecommendations.length === 0 && <p className="empty-table">No recommendations in this category.</p>}
    {showForm && <div className="modal-backdrop"><form className="recommendation-modal" onSubmit={saveRecommendation}><div className="modal-heading"><div><span className="eyebrow">Care plan</span><h2>{editingId ? 'Edit Recommendation' : 'Add Recommendation'}</h2></div><button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="Close">×</button></div><label>Student name<input name="student" required defaultValue={editingId ? recommendations.find((item) => item.id === editingId)?.student : ''} /></label><label>Student ID<input name="studentId" required defaultValue={editingId ? recommendations.find((item) => item.id === editingId)?.studentId : ''} /></label><label>Category<select name="category" defaultValue="Therapy"><option>Therapy</option><option>Academic</option><option>Lifestyle</option></select></label><label>Priority<select name="priority" defaultValue="High Priority"><option>High Priority</option><option>Low Priority</option></select></label><label>Recommendation<textarea name="text" required defaultValue={editingId ? recommendations.find((item) => item.id === editingId)?.text : ''} /></label><button type="submit" className="primary-button">Save Recommendation</button></form></div>}
  </main>;
};
