import { useEffect, useState, type CSSProperties } from 'react';
import {
  ConsultationNote,
  WebConsultationItem,
  fetchConsultationNote,
  saveConsultationNote,
} from '../services/consultations';

interface ConsultationSummaryFormProps {
  appointment: WebConsultationItem;
  onDone: () => void;
}

const FIELD_GAP = 14;

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--doc-muted)',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--doc-panel)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'inherit',
  fontSize: '0.9rem',
  lineHeight: 1.5,
  resize: 'vertical',
  fontFamily: 'inherit',
};

export const ConsultationSummaryForm = ({ appointment, onDone }: ConsultationSummaryFormProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [existing, setExisting] = useState<ConsultationNote | null>(null);

  const [summary, setSummary] = useState('');
  const [observations, setObservations] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [followUp, setFollowUp] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const note = await fetchConsultationNote(appointment.id);
        if (cancelled) return;
        setExisting(note);
        setSummary(note?.summary ?? '');
        setObservations(note?.observations ?? '');
        setRecommendation(note?.recommendation ?? '');
        setFollowUp(note?.followUp ?? '');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the summary.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointment.id]);

  const canSave = !loading && !saving && summary.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await saveConsultationNote(appointment, {
        summary,
        observations,
        recommendation,
        followUp,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The summary could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel" aria-label="Consultation summary">
      <div className="panel-header">
        <h2>{existing ? 'Consultation summary' : 'Post-consultation summary'}</h2>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--doc-muted)', marginBottom: 16 }}>
        {appointment.patientName} · {appointment.scheduledTime}
        {existing ? ' · previously saved' : ''}
      </div>

      {saved ? (
        <div>
          <div
            style={{
              background: 'rgba(34,197,94,0.14)',
              border: '1px solid rgba(34,197,94,0.4)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: '0.88rem',
              lineHeight: 1.55,
            }}
          >
            Summary saved. The student and the administrators can now read it with this
            appointment.
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button type="button" className="primary-button" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: FIELD_GAP }}>
          <div>
            <label style={labelStyle} htmlFor="cp-summary">
              Session summary
            </label>
            <textarea
              id="cp-summary"
              style={{ ...inputStyle, minHeight: 110 }}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What was discussed in this consultation?"
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="cp-observations">
              Observations and assessment
            </label>
            <textarea
              id="cp-observations"
              style={{ ...inputStyle, minHeight: 90 }}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="How the student presented, mood, risk, notable signs."
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="cp-recommendation">
              Recommendation
            </label>
            <textarea
              id="cp-recommendation"
              style={{ ...inputStyle, minHeight: 90 }}
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="What the student should do next — coping steps, referrals, lifestyle changes."
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="cp-followup">
              Follow-up
            </label>
            <input
              id="cp-followup"
              type="text"
              style={inputStyle}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="e.g. Recheck in 2 weeks"
            />
          </div>

          {error ? <div className="error-inline">{error}</div> : null}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {saving ? 'Saving…' : existing ? 'Update summary' : 'Save summary'}
            </button>
            <button type="button" className="text-button" onClick={onDone}>
              Later
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
