import { ConsultationNote } from '../services/consultations';

interface ConsultationSummaryViewProps {
  note: ConsultationNote;
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

const SummaryField = ({ label, value }: { label: string; value: string | null }) =>
  value && value.trim() ? (
    <div className="summary-field">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  ) : null;

export const ConsultationSummaryView = ({ note }: ConsultationSummaryViewProps) => (
  <div className="consult-summary-view">
    <div className="consult-summary-head">
      <strong>After-visit summary</strong>
      {note.updatedAt ? <span>Saved {formatStamp(note.updatedAt)}</span> : null}
    </div>
    <SummaryField label="Session summary" value={note.summary} />
    <SummaryField label="Observations" value={note.observations} />
    <SummaryField label="Recommendation" value={note.recommendation} />
    <SummaryField label="Follow-up" value={note.followUp} />
  </div>
);

export const ConsultationSummaryEmpty = ({ message }: { message: string }) => (
  <div className="consult-summary-view is-empty">{message}</div>
);
