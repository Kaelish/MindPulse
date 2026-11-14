import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminResultRow, assessmentNameOf, bandForScore, fetchVisibleStressResults, setResultReviewed } from '../../services/admin';
import { DoctorEmpty, DoctorError, DoctorLoading, DoctorNotifications, DoctorResultCount } from '../../components/doctor/DoctorChrome';

const BAND_LABELS: Record<'low' | 'moderate' | 'high', string> = { low: 'Low', moderate: 'Moderate', high: 'High' };

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const AssessmentResultsView: React.FC<{ onViewFullCase?: () => void }> = ({ onViewFullCase }) => {
  const [results, setResults] = useState<AdminResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [level, setLevel] = useState('All Levels');
  const [emotion, setEmotion] = useState('All Emotions');
  const [search, setSearch] = useState('');
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchVisibleStressResults()
      .then((rows) => {
        if (active) setResults(rows);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load assessment results.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const bandOf = (result: AdminResultRow) => (result.score == null ? null : bandForScore(result.score));

  /** A session is the daily multi-modal check-in when it carries reaction time
   *  (and/or face confidence) — supplementary questionnaires save neither. */
  const isDailyAssessment = (result: AdminResultRow) =>
    result.reactionTimeMs != null || result.faceConfidence != null;

  const emotionOptions = useMemo(() => {
    const distinct = Array.from(new Set(results.map((result) => result.emotion).filter((value): value is string => Boolean(value)))).sort();
    return emotion === 'All Emotions' || distinct.includes(emotion) ? distinct : [emotion, ...distinct];
  }, [results, emotion]);

  const visibleResults = useMemo(() => results.filter((result) => {
    const band = bandOf(result);
    const matchesLevel = level === 'All Levels' || (band !== null && BAND_LABELS[band] === level);
    const matchesEmotion = emotion === 'All Emotions' || result.emotion === emotion;
    const matchesSearch = `${result.studentName} ${result.id}`.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesEmotion && matchesSearch;
  }), [results, level, emotion, search]);

  /**
   * A-3: the marker is persisted (reviewed_at / reviewed_by, migration 0030),
   * not component state — it now survives reloads and is shared with the
   * rest of the care team. The flip is optimistic and rolls back if the
   * write is rejected (RLS, network).
   */
  const toggleReviewed = async (result: AdminResultRow) => {
    const next = result.reviewedAt == null;
    setReviewError('');
    setResults((current) => current.map((row) => (
      row.id === result.id ? { ...row, reviewedAt: next ? new Date().toISOString() : null } : row
    )));
    try {
      await setResultReviewed(result.id, next);
    } catch (error) {
      setResults((current) => current.map((row) => (row.id === result.id ? { ...row, reviewedAt: result.reviewedAt } : row)));
      setReviewError(error instanceof Error ? error.message : 'Unable to save the review status.');
    }
  };

  const scored = results.filter((result) => result.score != null);
  const averageScore = scored.length
    ? `${Math.round(scored.reduce((sum, result) => sum + (result.score ?? 0), 0) / scored.length)}%`
    : '—';
  const highRisk = results.filter((result) => bandOf(result) === 'high').length;
  const reviewedCount = results.filter((result) => result.reviewedAt != null).length;

  const exportCsv = () => {
    const header = ['Result ID', 'Patient', 'Date', 'Score', 'Risk Level', 'Heart Rate', 'Survey Score', 'Reaction Time (ms)', 'Emotion'];
    const rows = visibleResults.map((result) => [
      result.id,
      result.studentName,
      formatDate(result.createdAt),
      result.score == null ? '' : String(result.score),
      result.stressLevel ?? (bandOf(result) ? BAND_LABELS[bandOf(result)!] : ''),
      result.heartRate == null ? '' : String(result.heartRate),
      result.surveyScore == null ? '' : String(result.surveyScore),
      result.reactionTimeMs == null ? '' : String(result.reactionTimeMs),
      result.emotion ?? '',
    ]);
    const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assessment-results.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return <main className="main-panel assessment-results-main">
    <header className="topbar assessment-results-topbar"><div><h1>Assessment Results</h1><p className="page-subtitle">Review and analyze patient stress assessment results</p></div><div className="header-actions"><button type="button" className="ghost-button" onClick={exportCsv} disabled={isLoading || !!loadError || visibleResults.length === 0} title={visibleResults.length === 0 ? 'There are no results to export yet' : undefined}>Export</button><DoctorNotifications /></div></header>
    <section className="assessment-summary-grid">
      <Summary label="Total Assessments" value={String(results.length)} change="" tone="green" />
      <Summary label="High Risk" value={String(highRisk)} change="" tone="red" />
      <Summary label="Average Score" value={averageScore} change="" tone="neutral" />
      <Summary label="Reviewed" value={String(reviewedCount)} change="" tone="green" />
    </section>
    <section className="assessment-filter-bar">
      <label className="assessment-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users name or ID" /></label>
      <select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filter assessment level"><option>All Levels</option><option>Low</option><option>Moderate</option><option>High</option></select>
      <select value={emotion} onChange={(event) => setEmotion(event.target.value)} aria-label="Filter assessment emotion"><option>All Emotions</option>{emotionOptions.map((value) => <option key={value}>{value}</option>)}</select>
      <DoctorResultCount shown={visibleResults.length} total={results.length} noun="results" />
    </section>
    {reviewError && <p className="case-load-error is-error" role="alert">{reviewError}</p>}
    <section className="assessment-list-panel">
      {isLoading && <DoctorLoading label="Loading assessment results…" variant="skeleton" rows={4} />}
      {!isLoading && loadError && <DoctorError message={loadError} onRetry={retry} />}
      {!isLoading && !loadError && <>
        {visibleResults.length > 0 && <div className="assessment-list">{visibleResults.map((result) => {
          const band = bandOf(result);
          const riskLabel = result.stressLevel ?? (band ? BAND_LABELS[band] : '—');
          const riskClass = (result.stressLevel ?? band ?? '').toLowerCase();
          const isReviewed = result.reviewedAt != null;
          const daily = isDailyAssessment(result);
          return <article className="assessment-card" key={result.id}>
            <div className="assessment-card-header">
              <div className="assessment-student"><span className="account-avatar">{(result.studentName || 'Patient').trim().charAt(0).toUpperCase()}</span><div><div className="assessment-name-row"><span className="scan-label">{result.studentName}</span>{daily ? <span className="daily-pill">Daily assessment</span> : <span className="supplementary-pill">Supplementary assessment</span>}</div><strong>{result.id.slice(0, 8)}</strong><div className="assessment-meta"><small>{formatDate(result.createdAt)}</small> <span>·</span> <small>{assessmentNameOf(result)}</small></div></div></div>
              <div className="assessment-score"><strong>{result.score == null ? '—' : `${result.score}%`}</strong><span className={`risk-badge ${riskClass}`}>{riskLabel}</span></div>
              <button type="button" className="view-case-button" onClick={onViewFullCase}>View Full Case</button>
            </div>
            <div className="emotion-analysis">
              <span className="analysis-label">Key<br />Metrics:</span>
              <MetricBar label="Heart rate" value={result.heartRate == null ? '—' : `${result.heartRate} bpm`} width={result.heartRate == null ? 0 : Math.max(0, Math.min(100, result.heartRate))} color="blue" />
              <MetricBar label="Survey score" value={result.surveyScore == null ? '—' : String(result.surveyScore)} width={result.surveyScore == null ? 0 : Math.max(0, Math.min(100, result.surveyScore))} color="cyan" />
              <MetricBar label="Reaction time" value={result.reactionTimeMs == null ? '—' : `${result.reactionTimeMs} ms`} width={result.reactionTimeMs == null ? 0 : Math.max(0, Math.min(100, result.reactionTimeMs / 30))} color="green" />
              <MetricBar label="Facial confidence" value={result.faceConfidence == null ? '—' : `${result.faceConfidence}%`} width={result.faceConfidence == null ? 0 : Math.max(0, Math.min(100, result.faceConfidence))} color="blue" />
              <div className="emotion-bar" style={{ gridColumn: '2 / -1' }}><div><span>Emotion</span><b>{result.emotion ?? '—'}</b></div></div>
            </div>
            <button type="button" className={`review-button ${isReviewed ? 'reviewed' : ''}`} onClick={() => void toggleReviewed(result)}>{isReviewed ? 'Reviewed' : 'Mark as Reviewed'}</button>
          </article>;
        })}</div>}
        {visibleResults.length === 0 && (results.length === 0
          ? <DoctorEmpty title="No assessment results yet" description="Results appear here as soon as patients complete a stress assessment." />
          : <DoctorEmpty
              title="No results match your filters"
              description="Try another search term or reset the level and emotion filters."
              action={<button type="button" className="ghost-button" onClick={() => { setSearch(''); setLevel('All Levels'); setEmotion('All Emotions'); }}>Clear filters</button>}
            />)}
      </>}
    </section>
  </main>;
};

const Summary: React.FC<{ label: string; value: string; change: string; tone: 'green' | 'red' | 'neutral' }> = ({ label, value, change, tone }) => <article className={`assessment-summary-card ${tone}`}><span>{label}</span><strong>{value}</strong>{change && <small>{change}</small>}</article>;
const MetricBar: React.FC<{ label: string; value: string; width: number; color: 'blue' | 'cyan' | 'green' }> = ({ label, value, width, color }) => <div className="emotion-bar"><div><span>{label}</span><b>{value}</b></div><i className={color} style={{ width: `${Math.round(width)}%` }} /></div>;
