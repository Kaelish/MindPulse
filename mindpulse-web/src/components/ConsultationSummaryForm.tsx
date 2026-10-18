import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ConsultationNote,
  WebConsultationItem,
  fetchConsultationDurationMinutes,
  fetchConsultationNote,
  fetchCurrentDoctorDisplayName,
  removeConsultationAttachment,
  saveConsultationNote,
  setConsultationNoteSharing,
  uploadConsultationAttachment,
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

/** Fixed safety footer shown at the bottom of every progress note. */
const SAFETY_FOOTER =
  'Instructed the client to contact the clinic immediately if symptoms worsen. ' +
  'Instructed the client to call emergency services or go to the nearest emergency room ' +
  'if experiencing suicidal thoughts, homicidal thoughts, or any other medical or psychological crisis.';

const PAD_WIDTH = 640;
const PAD_HEIGHT = 200;

export const ConsultationSummaryForm = ({ appointment, onDone }: ConsultationSummaryFormProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<ConsultationNote | null>(null);
  const [existing, setExisting] = useState<ConsultationNote | null>(null);

  // Header
  const [sessionDate, setSessionDate] = useState(appointment.scheduledTime);
  const [sessionLocation, setSessionLocation] = useState('Virtual (Teleconsultation)');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [clientName, setClientName] = useState(appointment.patientName);
  const [clientDob, setClientDob] = useState('');
  const [psychologist, setPsychologist] = useState('');

  // Sections
  const [presentingProblem, setPresentingProblem] = useState('');
  const [sessionContent, setSessionContent] = useState('');
  const [interventions, setInterventions] = useState('');
  const [clientResponse, setClientResponse] = useState('');
  const [therapistObservations, setTherapistObservations] = useState('');
  const [mentalStatusExam, setMentalStatusExam] = useState('');
  const [riskAssessment, setRiskAssessment] = useState('');
  const [diagnosticImpressions, setDiagnosticImpressions] = useState('');
  const [planNextSession, setPlanNextSession] = useState('');
  const [returnToClinic, setReturnToClinic] = useState('');

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [padActive, setPadActive] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  // Scanned handwritten note
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploadingScan, setUploadingScan] = useState(false);

  // Sharing — private by default.
  const [sharedWithPatient, setSharedWithPatient] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const note = await fetchConsultationNote(appointment.id);
        if (cancelled) return;
        setExisting(note);
        if (note) {
          setSessionDate(note.sessionDate || appointment.scheduledTime);
          setSessionLocation(note.sessionLocation || 'Virtual (Teleconsultation)');
          setDurationMinutes(
            note.durationMinutes != null && !Number.isNaN(note.durationMinutes)
              ? String(note.durationMinutes)
              : '',
          );
          setClientName(note.clientName || appointment.patientName);
          setClientDob(note.clientDob);
          setPsychologist(note.psychologist);
          setPresentingProblem(note.presentingProblem);
          setSessionContent(note.sessionContent);
          setInterventions(note.interventions);
          setClientResponse(note.clientResponse);
          setTherapistObservations(note.therapistObservations);
          setMentalStatusExam(note.mentalStatusExam);
          setRiskAssessment(note.riskAssessment);
          setDiagnosticImpressions(note.diagnosticImpressions);
          setPlanNextSession(note.planNextSession);
          setReturnToClinic(note.returnToClinic);
          setSignature(note.signature);
          setPadActive(false);
          setAttachmentPath(note.attachmentPath);
          setAttachmentName(note.attachmentName);
          setSharedWithPatient(note.sharedWithPatient);
        } else {
          setPadActive(true);
        }

        // Prefills that are cosmetic — never block the form on them.
        if (!note?.durationMinutes) {
          const minutes = await fetchConsultationDurationMinutes(appointment.id);
          if (!cancelled && minutes != null) setDurationMinutes(String(minutes));
        }
        if (!note?.psychologist) {
          const name = await fetchCurrentDoctorDisplayName();
          if (!cancelled && name) setPsychologist(name);
        }
        if (!note?.sessionDate) {
          if (!cancelled) setSessionDate(appointment.scheduledTime);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the note.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointment.id, appointment.scheduledTime, appointment.patientName]);

  // --- signature pad plumbing -------------------------------------------------
  useEffect(() => {
    if (!padActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PAD_WIDTH;
    canvas.height = PAD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c2733';
    ctx.lineWidth = 2.4;
    if (signature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, PAD_WIDTH, PAD_HEIGHT);
      img.src = signature;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padActive]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const point = canvasPoint(event);
    if (!canvas || !ctx || !point) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const point = canvasPoint(event);
    if (!ctx || !point) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignature(canvas.toDataURL('image/jpeg', 0.85));
  };

  const clearSignature = () => {
    setSignature(null);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  // --- scanned handwritten note ------------------------------------------------
  const handleScanPicked = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploadingScan(true);
    try {
      const path = await uploadConsultationAttachment(appointment, file);
      if (attachmentPath) void removeConsultationAttachment(attachmentPath);
      setAttachmentPath(path);
      setAttachmentName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The scan could not be uploaded.');
    } finally {
      setUploadingScan(false);
      if (scanInputRef.current) scanInputRef.current.value = '';
    }
  };

  const removeScan = () => {
    if (attachmentPath) void removeConsultationAttachment(attachmentPath);
    setAttachmentPath(null);
    setAttachmentName(null);
  };

  // --- save --------------------------------------------------------------------
  const trimmed = (value: string) => value.trim().length > 0;
  const canSave =
    !loading &&
    !saving &&
    !uploadingScan &&
    (trimmed(presentingProblem) || trimmed(sessionContent));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const parsedDuration = Number.parseInt(durationMinutes, 10);
      const note = await saveConsultationNote(appointment, {
        sessionDate,
        sessionLocation,
        durationMinutes: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null,
        clientName,
        clientDob,
        psychologist,
        presentingProblem,
        sessionContent,
        interventions,
        clientResponse,
        therapistObservations,
        mentalStatusExam,
        riskAssessment,
        diagnosticImpressions,
        planNextSession,
        returnToClinic,
        signature,
        attachmentPath,
        attachmentName,
        sharedWithPatient,
      });
      setSavedNote(note);
      setExisting(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The note could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleShareToggle = async () => {
    if (shareBusy) return;
    const next = !sharedWithPatient;
    setShareBusy(true);
    setSharedWithPatient(next);
    try {
      if (existing) {
        // A saved note: persist immediately through the sharing endpoint.
        const updated = await setConsultationNoteSharing(appointment.id, next);
        setExisting(updated);
        setSavedNote((prev) => (prev ? updated : prev));
      }
      // Not saved yet — the flag rides along with the next save.
    } catch (err) {
      setSharedWithPatient(!next);
      setError(err instanceof Error ? err.message : 'The sharing setting could not be saved.');
    } finally {
      setShareBusy(false);
    }
  };

  const section = (
    id: string,
    label: string,
    value: string,
    setter: (next: string) => void,
    placeholder: string,
    minHeight = 90,
    clinicianOnly = false,
  ) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor={id}>
          {label}
        </label>
        {clinicianOnly ? (
          <span className="therapy-clinician-tag" title="Never shown to the student, even when the note is shared.">
            Clinician only
          </span>
        ) : null}
      </div>
      <textarea
        id={id}
        style={{ ...inputStyle, minHeight }}
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <section className="panel therapy-form" aria-label="Therapy progress note">
      <div className="panel-header">
        <h2>Therapy Progress Note</h2>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--doc-muted)', marginBottom: 16 }}>
        {appointment.patientName} · {appointment.scheduledTime}
        {existing ? ' · previously saved' : ''}
      </div>

      {savedNote ? (
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
            {savedNote.sharedWithPatient
              ? `Therapy progress note saved and shared with ${appointment.patientName}. They can now read the shared sections in their app.`
              : 'Therapy progress note saved. It is private to you and the clinic administrators — the student cannot see it unless you share it.'}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button type="button" className="primary-button" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: FIELD_GAP }}>
          {/* ---------------- header ---------------- */}
          <div className="therapy-meta-grid">
            <div>
              <label style={labelStyle} htmlFor="tp-date">
                Date of session
              </label>
              <input
                id="tp-date"
                type="text"
                style={inputStyle}
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                placeholder="e.g. Aug 9, 2023 at 3:30 PM"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tp-location">
                Location of session
              </label>
              <input
                id="tp-location"
                type="text"
                style={inputStyle}
                value={sessionLocation}
                onChange={(e) => setSessionLocation(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tp-duration">
                Duration of session (minutes)
              </label>
              <input
                id="tp-duration"
                type="number"
                min={1}
                style={inputStyle}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 45"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tp-client">
                Client name
              </label>
              <input
                id="tp-client"
                type="text"
                style={inputStyle}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tp-dob">
                Date of birth
              </label>
              <input
                id="tp-dob"
                type="text"
                style={inputStyle}
                value={clientDob}
                onChange={(e) => setClientDob(e.target.value)}
                placeholder="e.g. 12/12/2000"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tp-psych">
                Current psychologist
              </label>
              <input
                id="tp-psych"
                type="text"
                style={inputStyle}
                value={psychologist}
                onChange={(e) => setPsychologist(e.target.value)}
              />
            </div>
          </div>

          {/* ---------------- patient-facing sections ---------------- */}
          {section('tp-presenting', 'Presenting problem', presentingProblem, setPresentingProblem,
            'What brought the client in? Main concern and timeframe.', 90)}
          {section('tp-content', 'Session content', sessionContent, setSessionContent,
            'What was discussed and explored during this session?', 110)}
          {section('tp-interventions', 'Interventions', interventions, setInterventions,
            'Techniques used — e.g. cognitive restructuring, grounding exercises.', 90)}
          {section('tp-response', 'Client response', clientResponse, setClientResponse,
            'How the client engaged with and responded to the interventions.', 90)}

          {/* ---------------- clinician-only sections ---------------- */}
          {section('tp-observations', "Therapist's observations", therapistObservations, setTherapistObservations,
            'Motivation, engagement, insight, clinical impressions of behavior.', 90, true)}
          {section('tp-mse', 'Mental status examination', mentalStatusExam, setMentalStatusExam,
            'Appearance, behavior, speech, mood/affect, thought process, cognition.', 90, true)}
          {section('tp-risk', 'Risk assessment', riskAssessment, setRiskAssessment,
            'Suicidal or homicidal ideation, harm to self or others, protective factors.', 90, true)}
          {section('tp-diagnosis', 'Diagnostic impressions', diagnosticImpressions, setDiagnosticImpressions,
            'Working diagnoses — e.g. Generalized Anxiety Disorder.', 90, true)}

          {section('tp-plan', 'Plan for next session', planNextSession, setPlanNextSession,
            'What to continue or begin next session, homework, skill practice.', 90)}

          <div>
            <label style={labelStyle} htmlFor="tp-return">
              Return to clinic
            </label>
            <input
              id="tp-return"
              type="text"
              style={inputStyle}
              value={returnToClinic}
              onChange={(e) => setReturnToClinic(e.target.value)}
              placeholder="e.g. Every week"
            />
          </div>

          <p className="therapy-safety-footer">{SAFETY_FOOTER}</p>

          {/* ---------------- signature ---------------- */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <label style={labelStyle}>Signature</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {signature && !padActive ? (
                  <>
                    <button type="button" className="text-button" onClick={() => setPadActive(true)}>
                      Redo signature
                    </button>
                  </>
                ) : null}
                {signature ? (
                  <button type="button" className="text-button" onClick={clearSignature}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            {padActive ? (
              <canvas
                ref={canvasRef}
                className="therapy-sign-pad"
                aria-label="Signature pad — draw your signature with the mouse or a stylus"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            ) : signature ? (
              <img className="therapy-sign-preview" src={signature} alt="Saved signature" />
            ) : (
              <button type="button" className="text-button" onClick={() => setPadActive(true)}>
                Draw signature
              </button>
            )}
            <div style={{ fontSize: '0.78rem', color: 'var(--doc-muted)', marginTop: 6 }}>
              {padActive
                ? 'Draw with the mouse or a stylus, then press Done signing.'
                : signature
                  ? 'Signature saved with this note.'
                  : 'You can sign the note by hand on the pad.'}
            </div>
            {padActive ? (
              <button
                type="button"
                className="primary-button"
                style={{ marginTop: 8 }}
                onClick={() => setPadActive(false)}
                disabled={!signature}
              >
                Done signing
              </button>
            ) : null}
          </div>

          {/* ---------------- scanned handwritten note ---------------- */}
          <div>
            <label style={labelStyle}>Handwritten scan (optional)</label>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => void handleScanPicked(e.target.files?.[0])}
            />
            {attachmentPath ? (
              <div className="therapy-scan-chip">
                <span>{attachmentName ?? 'Attached scan'}</span>
                <button type="button" className="text-button" onClick={removeScan}>
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-button"
                onClick={() => scanInputRef.current?.click()}
                disabled={uploadingScan}
              >
                {uploadingScan ? 'Uploading…' : 'Attach a photo or scan of handwritten notes'}
              </button>
            )}
            <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: '#8a94a6', lineHeight: 1.5 }}>
              Private to you: the scan never leaves your side — even a shared note shows the student only
              the typed sections and your signature.
            </p>
          </div>

          {/* ---------------- sharing ---------------- */}
          <div className="therapy-share-row">
            <div className="therapy-share-copy">
              <strong>Share with {appointment.patientName.split(' ')[0] || 'the student'}</strong>
              <span>
                {sharedWithPatient
                  ? 'The student can read the shared sections of this note in their app (observations, mental status exam, risk, diagnostics, and any handwritten scan stay with you).'
                  : 'Off by default. This note stays private to you and the clinic administrators until you turn sharing on.'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sharedWithPatient}
              className={`doc-switch ${sharedWithPatient ? 'is-on' : ''}`}
              onClick={() => void handleShareToggle()}
              disabled={shareBusy}
            >
              <span className="doc-switch-knob" />
            </button>
          </div>

          {error ? <div className="error-inline">{error}</div> : null}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {saving ? 'Saving…' : existing ? 'Update note' : 'Save note'}
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
