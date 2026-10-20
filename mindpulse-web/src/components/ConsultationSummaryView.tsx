import { useEffect, useState } from 'react';
import {
  consultationNoteHasContent,
  createConsultationAttachmentUrl,
} from '../services/consultations';

/**
 * Structural shape the pad renders. Both the full ConsultationNote and the
 * student-case note record satisfy it.
 */
export interface ConsultationNoteViewData {
  appointmentId: string;
  sessionDate: string;
  sessionLocation: string;
  durationMinutes: number | null;
  clientName: string;
  clientDob: string;
  psychologist: string;
  summary: string;
  observations: string;
  recommendation: string;
  followUp: string | null;
  presentingProblem: string;
  sessionContent: string;
  interventions: string;
  clientResponse: string;
  therapistObservations: string;
  mentalStatusExam: string;
  riskAssessment: string;
  diagnosticImpressions: string;
  planNextSession: string;
  returnToClinic: string;
  signature: string | null;
  signedAt: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  /** The only field a patient may read, and only once published. */
  patientNote: string;
  patientNotePublished: boolean;
  /** Legacy flag from before the note became doctor-only. */
  sharedWithPatient: boolean;
  updatedAt?: string;
}

interface ConsultationSummaryViewProps {
  note: ConsultationNoteViewData;
  /**
   * When provided, a publish switch is rendered so the doctor can decide
   * whether the patient may read the short "Note for the patient". The
   * progress note itself is never offered for sharing. Omit for read-only
   * contexts.
   */
  onTogglePublish?: (published: boolean) => Promise<void>;
  publishBusy?: boolean;
  /**
   * When provided, an "Edit note" button is shown that reopens the editor
   * prefilled with this note. Omit for read-only contexts.
   */
  onEdit?: () => void;
}

const formatStamp = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

const SAFETY_FOOTER =
  'Instructed the client to contact the clinic immediately if symptoms worsen. ' +
  'Instructed the client to call emergency services or go to the nearest emergency room ' +
  'if experiencing suicidal thoughts, homicidal thoughts, or any other medical or psychological crisis.';

const has = (value?: string | null): boolean => !!(value && value.trim());

const PadSection = ({
  label,
  value,
  clinicianOnly = false,
}: {
  label: string;
  value?: string | null;
  clinicianOnly?: boolean;
}) =>
  has(value) ? (
    <div className="tp-pad-row">
      <div className="tp-pad-label">
        {label}
        {clinicianOnly ? <span className="therapy-clinician-tag">Clinician only</span> : null}
      </div>
      <div className="tp-pad-value">{value}</div>
    </div>
  ) : null;

const LegacyField = ({ label, value }: { label: string; value?: string | null }) =>
  has(value) ? (
    <div className="tp-pad-row">
      <div className="tp-pad-label">{label}</div>
      <div className="tp-pad-value">{value}</div>
    </div>
  ) : null;

export const ConsultationSummaryView = ({
  note,
  onTogglePublish,
  publishBusy = false,
  onEdit,
}: ConsultationSummaryViewProps) => {
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!note.attachmentPath) {
      setScanUrl(null);
      setScanError(false);
      return;
    }
    createConsultationAttachmentUrl(note.attachmentPath)
      .then((url) => {
        if (!cancelled) setScanUrl(url);
      })
      .catch(() => {
        if (!cancelled) setScanError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [note.attachmentPath]);

  const isLegacy = !has(note.presentingProblem) && !has(note.sessionContent) && consultationNoteHasContent(note);

  return (
    <div className="therapy-pad-wrap">
      {/* publish bar (doctor only — rendered when a toggle handler is passed) */}
      {onTogglePublish ? (
        <div className="therapy-share-row">
          <div className="therapy-share-copy">
            <strong>
              {note.patientNotePublished && has(note.patientNote)
                ? 'Note for the patient is published'
                : 'Note for the patient is a draft'}
            </strong>
            <span>
              {note.patientNotePublished && has(note.patientNote)
                ? 'The patient can read that one note in their app. Everything on this pad — presenting problem through clinical impressions — stays with you and the clinic administrators.'
                : 'Nothing on this record reaches the patient. Publish the note below if they should read something.'}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={note.patientNotePublished && has(note.patientNote)}
            className={`doc-switch ${note.patientNotePublished && has(note.patientNote) ? 'is-on' : ''}`}
            disabled={publishBusy || !has(note.patientNote)}
            onClick={() => void onTogglePublish(!(note.patientNotePublished && has(note.patientNote)))}
          >
            <span className="doc-switch-knob" />
          </button>
        </div>
      ) : null}

      <div className="therapy-pad" id={`therapy-pad-${note.appointmentId}`}>
        <h3 className="tp-pad-title">THERAPY PROGRESS NOTE</h3>

        {/* header block */}
        <div className="tp-pad-grid">
          <div className="tp-pad-cell tp-pad-cell-label">Date of session</div>
          <div className="tp-pad-cell tp-pad-cell-value">{note.sessionDate || '—'}</div>
          <div className="tp-pad-cell tp-pad-cell-label">Location of session</div>
          <div className="tp-pad-cell tp-pad-cell-value">{note.sessionLocation || 'Virtual (Teleconsultation)'}</div>
          <div className="tp-pad-cell tp-pad-cell-label">Duration of session</div>
          <div className="tp-pad-cell tp-pad-cell-value">
            {note.durationMinutes != null ? `${note.durationMinutes} minutes` : '—'}
          </div>
        </div>

        <div className="tp-pad-subhead">PATIENT DEMOGRAPHIC INFORMATION</div>
        <div className="tp-pad-grid">
          <div className="tp-pad-cell tp-pad-cell-label">Client name</div>
          <div className="tp-pad-cell tp-pad-cell-value">{note.clientName || '—'}</div>
          <div className="tp-pad-cell tp-pad-cell-label">Date of birth</div>
          <div className="tp-pad-cell tp-pad-cell-value">{note.clientDob || '—'}</div>
          <div className="tp-pad-cell tp-pad-cell-label">Current psychologist</div>
          <div className="tp-pad-cell tp-pad-cell-value">{note.psychologist || '—'}</div>
        </div>

        {/* sections */}
        {isLegacy ? (
          <>
            <LegacyField label="Session summary" value={note.summary} />
            <LegacyField label="Observations" value={note.observations} />
            <LegacyField label="Recommendation" value={note.recommendation} />
            <LegacyField label="Follow-up" value={note.followUp} />
          </>
        ) : (
          <>
            <PadSection label="Presenting problem" value={note.presentingProblem} />
            <PadSection label="Session content" value={note.sessionContent} />
            <PadSection label="Interventions" value={note.interventions} />
            <PadSection label="Client response" value={note.clientResponse} />
            <PadSection label="Therapist's observations" value={note.therapistObservations} clinicianOnly />
            <PadSection label="Mental status examination" value={note.mentalStatusExam} clinicianOnly />
            <PadSection label="Risk assessment" value={note.riskAssessment} clinicianOnly />
            <PadSection label="Clinical impressions" value={note.diagnosticImpressions} clinicianOnly />
            <PadSection label="Plan for next session" value={note.planNextSession} />
            <PadSection label="Return to clinic" value={note.returnToClinic} />
          </>
        )}

        {/* The single field a patient may read — flagged so the doctor always
            knows what can leave the chart. */}
        {has(note.patientNote) ? (
          <div className="tp-pad-row">
            <div className="tp-pad-label">
              Note for the patient
              <span className={`therapy-clinician-tag ${note.patientNotePublished ? 'is-patient' : ''}`}>
                {note.patientNotePublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="tp-pad-value">{note.patientNote}</div>
          </div>
        ) : null}

        {has(SAFETY_FOOTER) ? <p className="tp-pad-safety">{SAFETY_FOOTER}</p> : null}

        {/* handwritten scan */}
        {note.attachmentPath ? (
          <div className="tp-pad-scan">
            <span className="tp-pad-scan-label">Handwritten note (attached scan — private to you)</span>
            {scanUrl ? (
              scanUrl.toLowerCase().endsWith('.pdf') ? (
                <a href={scanUrl} target="_blank" rel="noreferrer">
                  {note.attachmentName ?? 'Open attached scan'}
                </a>
              ) : (
                <a href={scanUrl} target="_blank" rel="noreferrer">
                  <img className="tp-pad-scan-img" src={scanUrl} alt={note.attachmentName ?? 'Attached handwritten note'} />
                </a>
              )
            ) : scanError ? (
              <span className="tp-pad-scan-missing">The attached scan could not be opened.</span>
            ) : (
              <span className="tp-pad-scan-missing">Opening scan…</span>
            )}
          </div>
        ) : null}

        {/* signature block */}
        <div className="tp-pad-sign">
          {note.signature ? <img className="tp-pad-sign-img" src={note.signature} alt="Signature" /> : null}
          <div className="tp-pad-sign-line">
            <span className="tp-pad-sign-name">{note.psychologist || 'Psychologist'}</span>
            <span className="tp-pad-sign-date">
              {note.signedAt ? formatStamp(note.signedAt) : note.sessionDate}
            </span>
          </div>
        </div>

        <div className="tp-pad-stamp">
          Therapy progress note · saved {formatStamp(note.updatedAt)} · private to the doctor and
          clinic administrators{note.patientNotePublished && has(note.patientNote) ? ' · patient note published' : ''}
        </div>
      </div>

      <div className="tp-pad-actions">
        {onEdit ? (
          <button type="button" className="text-button tp-pad-print" onClick={onEdit}>
            ✎ Edit note
          </button>
        ) : null}
        <button
          type="button"
          className="text-button tp-pad-print"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
};

export const ConsultationSummaryEmpty = ({ message }: { message: string }) => (
  <div className="consult-summary-view is-empty">{message}</div>
);
