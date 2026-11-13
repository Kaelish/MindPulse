import React, { useEffect, useRef, useState } from 'react';
import { AssessmentToolOption } from '../../services/assessmentTools';

interface QuestionEditModalProps {
  /** 1-based position of the question in the questionnaire list. */
  position: number;
  /** Total questions in the list — bounds the position input. */
  total: number;
  /** Question text as stored in the parent form when the modal opened. */
  initialText: string;
  /** Custom answer options on the question; absent/empty = default 0–4 scale. */
  initialOptions?: AssessmentToolOption[];
  /** Commit the draft to the parent form. Only ever called on Save. */
  onSave: (draft: { text: string; position: number; options?: AssessmentToolOption[] }) => void;
  /** Discard the draft without touching the parent form and close. */
  onCancel: () => void;
}

/**
 * One editable option row. The score stays a string while editing so it can be
 * left blank (blank → the row's index on save); the label is free text.
 */
interface OptionRow {
  label: string;
  value: string;
}

/**
 * The app's standard 0–4 scale (mirrors the mobile DEFAULT_LIKERT). Shown
 * read-only while the question has no custom options, and used to seed the
 * editable rows when the admin switches to a custom set such as
 * "Not at all → Extremely".
 */
const DEFAULT_SCALE: readonly AssessmentToolOption[] = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Almost Never' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Fairly Often' },
  { value: 4, label: 'Very Often' },
];

const seedRows = (options?: AssessmentToolOption[]): OptionRow[] =>
  options && options.length
    ? options.map((option) => ({ label: option.label, value: String(option.value) }))
    : DEFAULT_SCALE.map((option) => ({ label: option.label, value: String(option.value) }));

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]';

/**
 * Scoped editor for a single questionnaire item: text, position and answer
 * options. The draft lives entirely in this component's local state, so typing
 * here never touches the parent assessment form — the parent is only updated
 * when Save runs, which commits text + position + options atomically.
 */
export const QuestionEditModal: React.FC<QuestionEditModalProps> = ({
  position,
  total,
  initialText,
  initialOptions,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(initialText);
  const [target, setTarget] = useState(String(position));
  const [customScale, setCustomScale] = useState(Boolean(initialOptions && initialOptions.length));
  const [rows, setRows] = useState<OptionRow[]>(() => seedRows(initialOptions));
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus the first field on open; hand focus back to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const field = modalRef.current?.querySelector<HTMLTextAreaElement>('textarea');
    (field ?? modalRef.current)?.focus();
    return () => {
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    // Focus trap: Tab wraps from the last control to the first (and back).
    const node = modalRef.current;
    if (!node) return;
    const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const outside = !active || !node.contains(active);
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  };

  /** Patch one option row; every other row is untouched. */
  const updateRow = (index: number, patch: Partial<OptionRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setError('');
  };

  const addRow = () => {
    setRows((current) => [...current, { label: '', value: String(current.length) }]);
    setError('');
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, i) => i !== index));
    setError('');
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      next[index] = current[targetIndex];
      next[targetIndex] = current[index];
      return next;
    });
    setError('');
  };

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Question text cannot be empty.');
      return;
    }

    let options: AssessmentToolOption[] | undefined;
    if (customScale) {
      if (rows.length < 2) {
        setError('A custom scale needs at least two options.');
        return;
      }
      const labels = rows.map((row) => row.label.trim());
      if (labels.some((label) => !label)) {
        setError('Every option needs a label.');
        return;
      }
      const seen = new Set<string>();
      for (const label of labels) {
        const key = label.toLowerCase();
        if (seen.has(key)) {
          setError(`Duplicate option "${label}" — every option needs different wording.`);
          return;
        }
        seen.add(key);
      }
      options = rows.map((row, index) => {
        const raw = row.value.trim();
        const parsed = raw === '' ? NaN : Number(raw);
        return { value: Number.isFinite(parsed) ? parsed : index, label: row.label.trim() };
      });
    }

    const parsed = parseInt(target, 10);
    const clamped = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), Math.max(total, 1))
      : position;
    onSave({ text: trimmed, position: clamped, options });
  };

  return (
    <div className="assessment-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="assessment-modal question-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit question ${position}`}
        ref={modalRef}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="assessment-modal-head">
          <h2>Edit Question {position}</h2>
          <button type="button" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <label className="assessment-field">
          <span>Question text</span>
          <textarea
            rows={3}
            value={text}
            placeholder="Type the question as patients will see it"
            onChange={(event) => {
              setText(event.target.value);
              setError('');
            }}
          />
        </label>

        <div className="assessment-field question-modal-position">
          <label>
            <span>Position in list</span>
            <input
              type="number"
              min={1}
              max={Math.max(total, 1)}
              value={target}
              onChange={(event) => {
                setTarget(event.target.value);
                setError('');
              }}
            />
          </label>
          <small>1 is the first question. Saved questions keep their ids.</small>
        </div>

        <div className="assessment-field">
          <span>Answer options</span>
          <label className="question-modal-custom">
            <input
              type="checkbox"
              checked={customScale}
              onChange={(event) => {
                setCustomScale(event.target.checked);
                setError('');
              }}
            />
            Custom options
          </label>

          {customScale ? (
            <>
              <div className="option-row-list">
                {rows.map((row, index) => (
                  <div className="option-row" key={index}>
                    <span className="question-box-index">O{index + 1}</span>
                    <input
                      type="text"
                      className="option-row-text"
                      aria-label={`Option ${index + 1} text`}
                      value={row.label}
                      placeholder="e.g. Not at all"
                      onChange={(event) => updateRow(index, { label: event.target.value })}
                    />
                    <input
                      type="number"
                      className="option-row-value"
                      aria-label={`Option ${index + 1} value`}
                      value={row.value}
                      placeholder="score"
                      onChange={(event) => updateRow(index, { value: event.target.value })}
                    />
                    <div className="question-box-tools">
                      <button
                        type="button"
                        aria-label="Move option up"
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move option down"
                        disabled={index === rows.length - 1}
                        onClick={() => moveRow(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="question-box-remove"
                        aria-label="Remove option"
                        onClick={() => removeRow(index)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="question-add-button" onClick={addRow}>
                ＋ Add option
              </button>
              <small>
                Patients pick one option per question; the score is its value (blank = row
                position). At least two options are required, and no two may repeat the wording.
              </small>
            </>
          ) : (
            <small>
              Default scale: Never → Almost Never → Sometimes → Fairly Often → Very Often (0–4).
              Tick “Custom options” to define your own answers, e.g. Not at all → Extremely.
            </small>
          )}
        </div>

        {error && <div className="assessment-banner error">{error}</div>}

        <div className="assessment-modal-actions">
          <button type="button" className="assessment-button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="assessment-button primary" onClick={save}>
            Save Question
          </button>
        </div>
      </div>
    </div>
  );
};
