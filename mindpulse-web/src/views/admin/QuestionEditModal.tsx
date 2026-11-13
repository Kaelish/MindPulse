import React, { useEffect, useRef, useState } from 'react';

interface QuestionEditModalProps {
  /** 1-based position of the question in the questionnaire list. */
  position: number;
  /** Total questions in the list — bounds the position input. */
  total: number;
  /** Question text as stored in the parent form when the modal opened. */
  initialText: string;
  /** Commit the draft to the parent form. Only ever called on Save. */
  onSave: (draft: { text: string; position: number }) => void;
  /** Discard the draft without touching the parent form and close. */
  onCancel: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]';

/**
 * Scoped editor for a single questionnaire item. The draft lives entirely in
 * this component's local state, so typing here never touches the parent
 * assessment form — the parent is only updated when Save runs.
 */
export const QuestionEditModal: React.FC<QuestionEditModalProps> = ({
  position,
  total,
  initialText,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(initialText);
  const [target, setTarget] = useState(String(position));
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

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Question text cannot be empty.');
      return;
    }
    const parsed = parseInt(target, 10);
    const clamped = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), Math.max(total, 1))
      : position;
    onSave({ text: trimmed, position: clamped });
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
