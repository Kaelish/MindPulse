import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createRecommendation,
  DoctorRecommendation,
  fetchAppointmentStudents,
  fetchDoctorRecommendations,
  updateRecommendation,
} from '../../services/recommendations';
import type { RecommendationPriority } from '../../types/supabase';

type AppointmentStudent = { id: string; first_name: string | null; last_name: string | null; email: string | null; student_no: string | null };

const CATEGORIES = ['General', 'Therapy', 'Academic', 'Lifestyle', 'Wellness'];
const PRIORITIES: RecommendationPriority[] = ['Low', 'Medium', 'High'];

const studentLabel = (student: AppointmentStudent) => {
  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email || 'Unknown student';
  return student.student_no ? `${name} · ${student.student_no}` : name;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const RecommendationsView: React.FC = () => {
  const [recommendations, setRecommendations] = useState<DoctorRecommendation[]>([]);
  const [students, setStudents] = useState<AppointmentStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Active' | 'Completed'>('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    Promise.all([fetchDoctorRecommendations(), fetchAppointmentStudents()])
      .then(([records, appointmentStudents]) => {
        if (!active) return;
        setRecommendations(records);
        setStudents(appointmentStudents);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load recommendations.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = async () => {
    const records = await fetchDoctorRecommendations();
    setRecommendations(records);
  };

  const visibleRecommendations = useMemo(
    () => (activeFilter === 'All' ? recommendations : recommendations.filter((item) => item.status === activeFilter)),
    [activeFilter, recommendations],
  );

  const openAdd = () => {
    setEditingId(null);
    setSaved(false);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (item: DoctorRecommendation) => {
    setEditingId(item.id);
    setSaved(false);
    setFormError('');
    setShowForm(true);
  };

  const saveRecommendation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get('category'));
    const priority = String(form.get('priority')) as RecommendationPriority;
    const note = String(form.get('note'));
    setIsSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await updateRecommendation(editingId, { category, priority, note });
      } else {
        await createRecommendation({ studentId: String(form.get('studentId')), category, priority, note });
      }
      await refresh();
      setShowForm(false);
      setEditingId(null);
      setSaved(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the recommendation.');
    } finally {
      setIsSaving(false);
    }
  };

  const markComplete = async (id: string) => {
    setActionError('');
    try {
      await updateRecommendation(id, { status: 'Completed' });
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the recommendation.');
    }
  };

  const editing = editingId ? recommendations.find((item) => item.id === editingId) : undefined;
  const hasStudents = students.length > 0;

  return <main className="main-panel recommendations-main">
    <header className="topbar recommendations-topbar"><div><h1>Give Recommendations</h1><p className="page-subtitle">Create and manage student recommendations and action plans</p></div><button type="button" className="notification-button" aria-label="Notifications"><span className="bell-icon" /></button></header>
    <div className="recommendations-toolbar">
      <div className="recommendation-filters">{(['All', 'Active', 'Completed'] as const).map((filter) => <button type="button" key={filter} className={activeFilter === filter ? 'active' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div>
      <button type="button" className="add-recommendation-button" disabled={!hasStudents || isLoading} onClick={openAdd}>+ Add Recommendations</button>
    </div>
    {saved && <div className="recommendation-save-banner">Recommendation saved successfully.</div>}
    {actionError && <p className="case-load-error">{actionError}</p>}
    {isLoading && <p className="case-loading">Loading recommendations…</p>}
    {!isLoading && loadError && <p className="case-load-error">{loadError} <button type="button" className="text-button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button></p>}
    {!isLoading && !loadError && <>
      <section className="recommendation-list">{visibleRecommendations.map((item) => <article className="recommendation-card" key={item.id}>
        <div className="recommendation-card-content">
          <div className="recommendation-title-row"><h2>{item.studentName}</h2><span className="recommendation-category">{item.category}</span><span className={`recommendation-priority ${item.priority === 'High' ? 'high' : 'low'}`}>{item.priority}</span></div>
          <p>{item.note}</p>
          <div className="recommendation-meta"><span>Created: {formatDate(item.createdAt)}</span><span className={item.status === 'Completed' ? 'recommendation-completed' : ''}>{item.status}</span></div>
          <div className="recommendation-actions">{item.status !== 'Completed' && <button type="button" className="complete-recommendation" onClick={() => markComplete(item.id)}>Mark as Completed</button>}<button type="button" className="edit-recommendation" onClick={() => openEdit(item)}>Edit</button></div>
        </div>
        <div className="recommendation-student-id"><span>Student ID</span><strong>{item.studentNo}</strong></div>
      </article>)}</section>
      {visibleRecommendations.length === 0 && <p className="empty-table">{hasStudents ? 'No recommendations in this category.' : 'Book a consultation before giving recommendations.'}</p>}
      {!hasStudents && visibleRecommendations.length > 0 && <p className="empty-table">Book a consultation before giving recommendations.</p>}
    </>}
    {showForm && <div className="modal-backdrop"><form className="recommendation-modal" onSubmit={saveRecommendation}>
      <div className="modal-heading"><div><span className="eyebrow">Care plan</span><h2>{editing ? 'Edit Recommendation' : 'Add Recommendation'}</h2></div><button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="Close">×</button></div>
      {!editing && <label>Student<select name="studentId" required defaultValue=""><option value="" disabled>Select a student</option>{students.map((student) => <option key={student.id} value={student.id}>{studentLabel(student)}</option>)}</select></label>}
      <label>Category<select name="category" defaultValue={editing?.category ?? 'General'}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Priority<select name="priority" defaultValue={editing?.priority ?? 'Medium'}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
      <label>Recommendation<textarea name="note" required defaultValue={editing?.note ?? ''} /></label>
      {formError && <p className="case-load-error">{formError}</p>}
      <button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save Recommendation'}</button>
    </form></div>}
  </main>;
};
