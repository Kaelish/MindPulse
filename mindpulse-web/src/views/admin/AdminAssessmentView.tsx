import React, { useEffect, useMemo, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import {
  AssessmentCategory,
  AssessmentStatus,
  AssessmentTool,
  AssessmentToolInput,
  AssessmentToolQuestion,
  createAssessmentTool,
  deleteAssessmentTool,
  fetchAssessmentTools,
  nextQuestionId,
  sanitizeQuestions,
  updateAssessmentTool,
} from '../../services/assessmentTools';
import { AssessmentOutcomes, fetchAssessmentOutcomes } from '../../services/assessmentOutcomes';
import { AdminResultRow, assessmentNameOf } from '../../services/admin';
import './AdminAssessmentView.css';

type Mode = 'tools' | 'outcomes';

interface AdminAssessmentViewProps {
  onSignOut: () => void;
  onNavigate: (
    view: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'suggestions' | 'analytics' | 'profile' | 'settings',
  ) => void;
}

interface ToolForm {
  title: string;
  description: string;
  category: AssessmentCategory;
  status: AssessmentStatus;
  durationMinutes: string;
  questions: AssessmentToolQuestion[];
}

const EMPTY_FORM: ToolForm = {
  title: '',
  description: '',
  category: 'Supplementary',
  status: 'active',
  durationMinutes: '5',
  questions: [{ id: 1, text: '' }],
};

const COMPONENT_COLORS: Record<string, string> = {
  survey: '#7c6ff0',
  heartRate: '#ef6b6b',
  facial: '#4bb7cb',
  reaction: '#f2b33d',
};

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('en-CA');

const levelPill = (level: string | null): string => {
  const normalized = (level ?? '').toLowerCase();
  return `status-pill ${normalized === 'low' || normalized === 'moderate' || normalized === 'high' ? `status-pill-${normalized}` : 'status-pill-active'}`;
};

export const AdminAssessmentView: React.FC<AdminAssessmentViewProps> = ({ onSignOut, onNavigate }) => {
  const [mode, setMode] = useState<Mode>('tools');
  const [showNotifications, setShowNotifications] = useState(false);

  const [tools, setTools] = useState<AssessmentTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ToolForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [outcomes, setOutcomes] = useState<AssessmentOutcomes | null>(null);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [outcomesError, setOutcomesError] = useState('');
  const [viewing, setViewing] = useState<AdminResultRow | null>(null);
  const [showAllRecent, setShowAllRecent] = useState(false);

  const loadTools = async () => {
    setToolsLoading(true);
    setToolsError('');
    try {
      setTools(await fetchAssessmentTools());
    } catch (error) {
      setToolsError(error instanceof Error ? error.message : 'Could not load assessment tools.');
    } finally {
      setToolsLoading(false);
    }
  };

  const loadOutcomes = async () => {
    setOutcomesLoading(true);
    setOutcomesError('');
    try {
      setOutcomes(await fetchAssessmentOutcomes());
    } catch (error) {
      setOutcomesError(error instanceof Error ? error.message : 'Could not load assessment outcomes.');
    } finally {
      setOutcomesLoading(false);
    }
  };

  useEffect(() => {
    void loadTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'outcomes' && !outcomes && !outcomesLoading) void loadOutcomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filteredTools = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tools;
    return tools.filter(
      (tool) =>
        tool.title.toLowerCase().includes(needle) || tool.description.toLowerCase().includes(needle),
    );
  }, [tools, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, questions: EMPTY_FORM.questions.map((question) => ({ ...question })) });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (tool: AssessmentTool) => {
    setEditingId(tool.id);
    setForm({
      title: tool.title,
      description: tool.description,
      category: tool.category,
      status: tool.status,
      durationMinutes: String(tool.durationMinutes),
      questions: tool.questions.map((question) => ({ ...question })),
    });
    setFormError('');
    setFormOpen(true);
  };

  /** Patch a single question box; every other box (and its metadata) is untouched. */
  const updateQuestion = (id: number, patch: Partial<AssessmentToolQuestion>) =>
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    }));

  const removeQuestion = (id: number) =>
    setForm((current) => ({
      ...current,
      questions: current.questions.filter((question) => question.id !== id),
    }));

  const addQuestion = () =>
    setForm((current) => ({
      ...current,
      questions: [...current.questions, { id: nextQuestionId(current.questions), text: '' }],
    }));

  const moveQuestion = (id: number, direction: -1 | 1) =>
    setForm((current) => {
      const index = current.questions.findIndex((question) => question.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      questions[index] = current.questions[target];
      questions[target] = current.questions[index];
      return { ...current, questions };
    });

  const saveTool = async () => {
    const duration = parseInt(form.durationMinutes, 10);
    const questions = sanitizeQuestions(form.questions);

    if (!form.title.trim()) {
      setFormError('Give the assessment a title.');
      return;
    }
    // Multi-Modal tools carry no patient-facing questions (A-10: the built-in
    // PSS-10 is version-locked inside the app), so an empty set is valid there.
    if (!questions.length && form.category !== 'Multi-Modal') {
      setFormError('Add at least one question.');
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      setFormError('Duration must be at least 1 minute.');
      return;
    }

    const input: AssessmentToolInput = {
      title: form.title,
      description: form.description,
      category: form.category,
      status: form.status,
      durationMinutes: duration,
      questions,
    };

    setSaving(true);
    setFormError('');
    try {
      if (editingId) await updateAssessmentTool(editingId, input);
      else await createAssessmentTool(input);
      setFormOpen(false);
      await loadTools();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the assessment.');
    } finally {
      setSaving(false);
    }
  };

  const removeTool = async (tool: AssessmentTool) => {
    if (!window.confirm(`Delete "${tool.title}"? Patients will no longer see it.`)) return;
    try {
      await deleteAssessmentTool(tool.id);
      await loadTools();
    } catch (error) {
      setToolsError(error instanceof Error ? error.message : 'Could not delete the assessment.');
    }
  };

  const headerActions = (
    <div className="account-actions">
      <button
        type="button"
        className="assessment-mode-pill"
        onClick={() => setMode(mode === 'tools' ? 'outcomes' : 'tools')}
      >
        {mode === 'tools' ? '📄 Assessment Outcomes' : '📋 Assessment Tools'}
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
  );

  return (
    <div className="admin-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="assessment" onNavigate={onNavigate} />
      <main className="admin-assessment-main">
        <header className="assessment-header">
          <div>
            <h1>{mode === 'tools' ? 'Manage Assessment Tools' : 'Review Assessment Outcomes'}</h1>
            <p>
              {mode === 'tools'
                ? 'Create and manage assessment questionnaires and surveys'
                : 'View and analyze assessment results'}
            </p>
          </div>
          {headerActions}
        </header>

        {mode === 'tools' && (
          <>
            <div className="assessment-toolbar">
              <div className="assessment-search">
                <span aria-hidden="true">⌕</span>
                <input
                  value={search}
                  placeholder="Search assessments"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <button type="button" className="assessment-create-button" onClick={openCreate}>
                ＋ Create Assessment
              </button>
            </div>

            {toolsError && <div className="assessment-banner error">{toolsError}</div>}

            {toolsLoading ? (
              <div className="assessment-empty">Loading assessment tools…</div>
            ) : filteredTools.length === 0 ? (
              <div className="assessment-empty">
                {search ? 'No assessments match your search.' : 'No assessments yet — create the first one.'}
              </div>
            ) : (
              <div className="assessment-card-grid">
                {filteredTools.map((tool) => (
                  <article className="assessment-tool-card" key={tool.id}>
                    <div className="assessment-tool-top">
                      <span className="assessment-tool-icon">📋</span>
                      <span className={`assessment-status-pill ${tool.status}`}>
                        {tool.status === 'active' ? 'Active' : tool.status === 'draft' ? 'Draft' : 'Archived'}
                      </span>
                    </div>
                    <h3>{tool.title}</h3>
                    <p className="assessment-tool-desc">{tool.description}</p>
                    <div className="assessment-tool-meta">
                      <span>{tool.questions.length} Questions</span>
                      <span>{tool.durationMinutes} min</span>
                    </div>
                    <div className="assessment-tool-actions">
                      <button type="button" className="assessment-edit-button" onClick={() => openEdit(tool)}>
                        ✏ Edit
                      </button>
                      <button type="button" className="assessment-delete-button" onClick={() => void removeTool(tool)}>
                        🗑
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'outcomes' && (
          <>
            {outcomesError && <div className="assessment-banner error">{outcomesError}</div>}
            {outcomesLoading && !outcomes ? (
              <div className="assessment-empty">Loading assessment outcomes…</div>
            ) : outcomes ? (
              <>
                <div className="assessment-stat-grid">
                  <article className="assessment-stat-card">
                    <span>Assessments This Month</span>
                    <strong>{outcomes.totalThisMonth}</strong>
                    <small>Since month start</small>
                  </article>
                  <article className="assessment-stat-card">
                    <span>Patients Assessed</span>
                    <strong>{outcomes.uniqueStudents}</strong>
                    <small>Unique Patients</small>
                  </article>
                  <article className="assessment-stat-card">
                    <span>Avg Overall Score</span>
                    <strong>
                      {outcomes.avgOverall ?? '—'}
                      <em>/100</em>
                    </strong>
                    <small>All-time</small>
                  </article>
                  <article className="assessment-stat-card">
                    <span>This Week</span>
                    <strong>{outcomes.thisWeek}</strong>
                    <small>Assessments</small>
                  </article>
                </div>

                <section className="assessment-panel">
                  <h2>Assessment Component Performance</h2>
                  <div className="assessment-component-grid">
                    {outcomes.components.map((component) => (
                      <article className="assessment-component-card" key={component.key}>
                        <div className="assessment-component-head">
                          <span>{component.label}</span>
                          <i style={{ background: COMPONENT_COLORS[component.key] }} />
                        </div>
                        <strong>
                          {component.avg}
                          <em>/{component.max}</em>
                        </strong>
                        <div className="assessment-component-track">
                          <div
                            style={{
                              width: `${component.max ? (component.avg / component.max) * 100 : 0}%`,
                              background: COMPONENT_COLORS[component.key],
                            }}
                          />
                        </div>
                        <small>
                          {component.sampleSize ? `Avg of ${component.sampleSize} sessions` : 'No data yet'}
                        </small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="assessment-panel">
                  <h2>{showAllRecent ? `All Assessment Details (${outcomes.recent.length})` : 'Recent Assessment Details'}</h2>
                  {outcomes.recent.length === 0 ? (
                    <div className="assessment-empty">No completed assessments yet.</div>
                  ) : (
                    <div className="assessment-table-wrap">
                      <table className="assessment-table">
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Date</th>
                            <th>Assessment</th>
                            <th>Overall Score</th>
                            <th>Level</th>
                            <th>Survey</th>
                            <th>Heart Rate</th>
                            <th>Emotion</th>
                            <th>RT (ms)</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(showAllRecent ? outcomes.recent : outcomes.recent.slice(0, 12)).map((row) => (
                            <tr key={row.id}>
                              <td>
                                <strong>{row.studentName}</strong>
                              </td>
                              <td>{formatDate(row.createdAt)}</td>
                              <td>{assessmentNameOf(row)}</td>
                              <td>{row.score == null ? '—' : `${row.score}/100`}</td>
                              <td>
                                <span className={levelPill(row.stressLevel)}>{row.stressLevel ?? '—'}</span>
                              </td>
                              <td>{row.surveyScore == null ? '—' : `${row.surveyScore}/100`}</td>
                              <td>{row.heartRate == null ? '—' : `${row.heartRate} bpm`}</td>
                              <td>{row.emotion ?? '—'}</td>
                              <td>{row.reactionTimeMs == null ? '—' : `${row.reactionTimeMs} ms`}</td>
                              <td>
                                <button type="button" className="assessment-view-button" onClick={() => setViewing(row)}>
                                  👁 View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {outcomes.recent.length > 12 && (
                    <button
                      type="button"
                      className="assessment-show-all"
                      onClick={() => setShowAllRecent((current) => !current)}
                    >
                      {showAllRecent ? 'Show latest 12 only' : `Show all ${outcomes.recent.length} assessments`}
                    </button>
                  )}
                </section>
              </>
            ) : (
              <div className="assessment-empty">Could not load outcomes.</div>
            )}
          </>
        )}
      </main>

      {formOpen && (
        <div className="assessment-modal-backdrop" role="presentation" onClick={() => !saving && setFormOpen(false)}>
          <div
            className="assessment-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Edit assessment' : 'Create assessment'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="assessment-modal-head">
              <h2>{editingId ? 'Edit Assessment' : 'Create Assessment'}</h2>
              <button type="button" onClick={() => !saving && setFormOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <label className="assessment-field">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. PSS-10 Stress Assessment"
              />
            </label>

            <label className="assessment-field">
              <span>Description</span>
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="e.g. Supplementary Survey"
              />
            </label>

            <div className="assessment-field-row">
              <label className="assessment-field">
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value as AssessmentCategory })}
                >
                  <option value="Multi-Modal">Multi-Modal</option>
                  <option value="Supplementary">Supplementary</option>
                  <option value="Brief">Brief</option>
                </select>
              </label>
              <label className="assessment-field">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as AssessmentStatus })}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="assessment-field">
                <span>Duration (min)</span>
                <input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
                />
              </label>
            </div>

            {form.category === 'Multi-Modal' && (
              <div className="assessment-note">
                ℹ <strong>PSS-10 is version-locked (A-10).</strong> Patients answer the app’s built-in PSS-10
                items — translated into English, Filipino and Cebuano — not the copy stored here, so edits made
                in this form never reach a patient. The question editor is therefore hidden for Multi-Modal
                tools. To author patient-facing questions of your own, set the category to Supplementary or Brief.
              </div>
            )}

            {/* Questions editor hidden for Multi-Modal (A-10: version-locked PSS-10). */}
            {form.category !== 'Multi-Modal' && (
            <div className="assessment-field">
              <span>{form.questions.length ? `Questions (${form.questions.length})` : 'Questions'}</span>
              <div className="question-box-list">
                {form.questions.length === 0 && (
                  <div className="question-box-empty">No questions yet — add the first one below.</div>
                )}
                {form.questions.map((question, index) => (
                  <div className="question-box" key={question.id}>
                    <div className="question-box-head">
                      <span className="question-box-index">Q{index + 1}</span>
                      <label
                        className="question-box-reverse"
                        title="Positively worded item (PSS-style): the score is inverted (max − answer) when scoring."
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(question.reverse)}
                          onChange={(event) =>
                            updateQuestion(question.id, { reverse: event.target.checked || undefined })
                          }
                        />
                        Reverse-scored
                      </label>
                      <div className="question-box-tools">
                        <button
                          type="button"
                          aria-label="Move question up"
                          disabled={index === 0}
                          onClick={() => moveQuestion(question.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Move question down"
                          disabled={index === form.questions.length - 1}
                          onClick={() => moveQuestion(question.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="question-box-remove"
                          aria-label="Delete question"
                          onClick={() => removeQuestion(question.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={question.text}
                      placeholder="e.g. How often have you felt nervous and stressed?"
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                    />
                  </div>
                ))}
              </div>
              <button type="button" className="question-add-button" onClick={addQuestion}>
                ＋ Add question
              </button>
              <small>
                Patients answer on a 0–4 scale (Never → Very Often) unless the question defines its own
                options. Tick “Reverse-scored” for positively worded items (e.g. “felt confident”) so they
                score correctly.
                Changes go live for patients once you save.
              </small>
            </div>
            )}

            {formError && <div className="assessment-banner error">{formError}</div>}

            <div className="assessment-modal-actions">
              <button
                type="button"
                className="assessment-button secondary"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="button" className="assessment-button primary" onClick={() => void saveTool()} disabled={saving}>
                {saving ? 'Saving…' : 'Save Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="assessment-modal-backdrop" role="presentation" onClick={() => setViewing(null)}>
          <div
            className="assessment-modal detail"
            role="dialog"
            aria-modal="true"
            aria-label="Assessment detail"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="assessment-modal-head">
              <h2>{viewing.studentName}</h2>
              <button type="button" onClick={() => setViewing(null)} aria-label="Close">
                ×
              </button>
            </div>
            <dl className="assessment-detail-grid">
              <div>
                <dt>Date</dt>
                <dd>{formatDate(viewing.createdAt)}</dd>
              </div>
              <div>
                <dt>Assessment</dt>
                <dd>{assessmentNameOf(viewing)}</dd>
              </div>
              <div>
                <dt>Overall Score</dt>
                <dd>{viewing.score == null ? '—' : `${viewing.score}/100`}</dd>
              </div>
              <div>
                <dt>Stress Level</dt>
                <dd>
                  <span className={levelPill(viewing.stressLevel)}>{viewing.stressLevel ?? '—'}</span>
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
            </dl>
            <div className="assessment-modal-actions">
              <button type="button" className="assessment-button primary" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
