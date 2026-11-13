import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminAssessmentView } from './AdminAssessmentView';
import {
  createAssessmentTool,
  deleteAssessmentTool,
  fetchAssessmentTools,
  isPss10Tool,
  updateAssessmentTool,
} from '../../services/assessmentTools';

jest.mock('../../components/navigation/AdminSidebar', () => ({
  AdminSidebar: () => null,
}));

jest.mock('../../components/NotificationBell', () => ({
  NotificationBell: () => null,
}));

jest.mock('../../components/NotificationPanel', () => ({
  NotificationPanel: () => null,
}));

jest.mock('../../services/assessmentTools', () => ({
  ...jest.requireActual('../../services/assessmentTools'),
  fetchAssessmentTools: jest.fn(),
  createAssessmentTool: jest.fn(),
  updateAssessmentTool: jest.fn(),
  deleteAssessmentTool: jest.fn(),
}));

jest.mock('../../services/assessmentOutcomes', () => ({
  fetchAssessmentOutcomes: jest.fn(),
}));

jest.mock('../../services/admin', () => ({
  assessmentNameOf: (row: { toolTitle?: string | null }) => row.toolTitle ?? 'Assessment',
}));

const pss10Tool = {
  id: 'tool-pss10',
  title: 'PSS-10 Stress Assessment',
  description: 'Multi-Modal (Survey + Facial + Heart Rate + Reaction Time)',
  category: 'Multi-Modal',
  status: 'active',
  durationMinutes: 15,
  questions: [
    {
      id: 1,
      text: 'In the last 24 hours, how often have you been upset because of something that happened unexpectedly?',
    },
    { id: 2, text: 'In the last 24 hours, how often have you felt nervous and stressed?' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const briefTool = {
  id: 'tool-brief',
  title: 'Follow-up Wellness Check',
  description: 'Brief Survey',
  category: 'Brief',
  status: 'active',
  durationMinutes: 5,
  questions: [
    { id: 1, text: 'Over the past week, how often did you feel calm and relaxed?', reverse: true },
    { id: 2, text: 'How often did stress interfere with your appetite or eating habits?' },
  ],
  createdAt: '2026-01-02T00:00:00.000Z',
};

/** The list textareas share this placeholder; the scoped editor uses its own. */
const QUESTION_PLACEHOLDER = 'e.g. How often have you felt nervous and stressed?';
const ORIGINAL_CALM = 'Over the past week, how often did you feel calm and relaxed?';
const ORIGINAL_APPETITE = 'How often did stress interfere with your appetite or eating habits?';

const renderView = () =>
  render(<AdminAssessmentView onSignOut={jest.fn()} onNavigate={jest.fn()} />);

/** Every questionnaire textbox, in document order. */
const questionBoxes = () =>
  screen.getAllByPlaceholderText(QUESTION_PLACEHOLDER) as HTMLTextAreaElement[];

/** The two card edit buttons, in the order fetchAssessmentTools resolved them. */
const cardEditButtons = () => screen.getAllByRole('button', { name: /^✏ Edit/ });

/** Every option label input inside a question modal, in list order. */
const optionTexts = (dialog: HTMLElement) =>
  within(dialog).getAllByLabelText(/^Option \d+ text$/) as HTMLInputElement[];

describe('AdminAssessmentView', () => {
  beforeEach(() => {
    (fetchAssessmentTools as jest.Mock).mockResolvedValue([pss10Tool, briefTool]);
    (createAssessmentTool as jest.Mock).mockResolvedValue({});
    (updateAssessmentTool as jest.Mock).mockResolvedValue({});
    (deleteAssessmentTool as jest.Mock).mockResolvedValue(undefined);
  });

  it('identifies the PSS-10 by its stable attributes, never by index', () => {
    expect(isPss10Tool({ title: 'PSS-10 Stress Assessment', category: 'Brief' })).toBe(true);
    expect(isPss10Tool({ title: 'Custom survey', category: 'Multi-Modal' })).toBe(true);
    expect(isPss10Tool({ title: 'Follow-up Wellness Check', category: 'Brief' })).toBe(false);
  });

  it('locks PSS-10 Category/Status and hides its delete while other tools stay editable', async () => {
    renderView();
    await screen.findByText('PSS-10 Stress Assessment');

    // Delete: exactly one delete button exists and it belongs to the brief
    // tool — the PSS-10 template offers no delete action at all.
    const deleteButtons = screen.getAllByRole('button', { name: '🗑' });
    expect(deleteButtons).toHaveLength(1);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(deleteButtons[0]);
    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete "Follow-up Wellness Check"? Patients will no longer see it.',
    );
    confirmSpy.mockRestore();

    // Editing the PSS-10 (first card): Category and Status are read-only,
    // nothing else is. The Title value proves which template opened.
    fireEvent.click(cardEditButtons()[0]);
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'PSS-10 Stress Assessment',
    );
    expect(screen.getByLabelText('Category')).toBeDisabled();
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(screen.getByLabelText('Title')).not.toBeDisabled();
    expect(screen.getByText(/Locked template/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Save Assessment' })).toBeDisabled(); // pristine
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'PSS-10 Stress Assessment (Daily)' },
    });
    expect(screen.getByRole('button', { name: 'Save Assessment' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Assessment' }));

    await waitFor(() =>
      expect(updateAssessmentTool).toHaveBeenCalledWith('tool-pss10', {
        title: 'PSS-10 Stress Assessment (Daily)',
        description: 'Multi-Modal (Survey + Facial + Heart Rate + Reaction Time)',
        category: 'Multi-Modal', // locked field sent back unchanged
        status: 'active', // locked field sent back unchanged
        durationMinutes: 15,
        questions: pss10Tool.questions,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Edit assessment' })).toBeNull(),
    );

    // A non-PSS-10 tool keeps both selects fully editable.
    fireEvent.click(cardEditButtons()[1]);
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Follow-up Wellness Check',
    );
    expect(screen.getByLabelText('Category')).not.toBeDisabled();
    expect(screen.getByLabelText('Status')).not.toBeDisabled();
    expect(screen.queryByText(/Locked template/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Edit assessment' })).toBeNull();
  });

  it('edits a single question in a scoped modal without touching the form until Save', async () => {
    renderView();
    await screen.findByText('Follow-up Wellness Check');

    fireEvent.click(cardEditButtons()[1]);
    expect(questionBoxes()).toHaveLength(2);

    const editButtons = screen.getAllByRole('button', { name: /^Edit question/ });
    expect(editButtons).toHaveLength(2);
    fireEvent.click(editButtons[0]);

    const dialog = screen.getByRole('dialog', { name: 'Edit question 1' });
    const draft = within(dialog).getByLabelText('Question text') as HTMLTextAreaElement;
    expect(draft).toHaveFocus();
    fireEvent.change(draft, { target: { value: 'Changed inside the modal only' } });

    // State isolation: the questionnaire list is untouched while the modal is open.
    expect(questionBoxes()[0].value).toBe(ORIGINAL_CALM);
    expect(questionBoxes()[1].value).toBe(ORIGINAL_APPETITE);

    // Escape closes (and discards) without saving.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Edit question 1' })).toBeNull();
    expect(questionBoxes()[0].value).toBe(ORIGINAL_CALM);

    // Reopen: Save commits both the reworded text and the new position.
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit question/ })[0]);
    const reopened = screen.getByRole('dialog', { name: 'Edit question 1' });
    fireEvent.change(within(reopened).getByLabelText('Question text'), {
      target: { value: 'Reworded calm question' },
    });
    fireEvent.change(within(reopened).getByLabelText('Position in list'), {
      target: { value: '2' },
    });
    fireEvent.click(within(reopened).getByRole('button', { name: 'Save Question' }));

    expect(screen.queryByRole('dialog', { name: 'Edit question 1' })).toBeNull();
    const saved = questionBoxes();
    expect(saved).toHaveLength(2);
    expect(saved[0].value).toBe(ORIGINAL_APPETITE);
    expect(saved[1].value).toBe('Reworded calm question');
  });

  it('confirms before discarding unsaved changes on Cancel', async () => {
    renderView();
    await screen.findByText('Follow-up Wellness Check');

    fireEvent.click(cardEditButtons()[1]);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed brief check' } });

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes to this assessment?');
    expect(screen.getByRole('dialog', { name: 'Edit assessment' })).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Edit assessment' })).toBeNull();
    confirmSpy.mockRestore();
  });

  it('blocks invalid submissions inline and appends a fresh question row', async () => {
    renderView();
    await screen.findByText('PSS-10 Stress Assessment');

    fireEvent.click(screen.getByRole('button', { name: /Create Assessment/ }));
    expect(screen.getByRole('button', { name: 'Save Assessment' })).toBeDisabled(); // pristine

    // Dirty but invalid → inline errors, no network call.
    fireEvent.change(screen.getByLabelText('Duration (min)'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Save Assessment' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Assessment' }));
    expect(await screen.findByText('Give the assessment a title.')).toBeInTheDocument();
    expect(createAssessmentTool).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Weekly Calm Check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Assessment' }));
    expect(await screen.findByText('Add at least one question.')).toBeInTheDocument();
    expect(createAssessmentTool).not.toHaveBeenCalled();

    // Add question appends one blank row without duplicating existing ones.
    fireEvent.click(screen.getByRole('button', { name: /Add question/ }));
    expect(questionBoxes()).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Duration (min)'), { target: { value: '5' } });
    fireEvent.change(questionBoxes()[1], { target: { value: 'Did you feel at ease this week?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Assessment' }));

    await waitFor(() => expect(createAssessmentTool).toHaveBeenCalledTimes(1));
    expect(createAssessmentTool).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Weekly Calm Check',
        category: 'Supplementary',
        status: 'active',
        durationMinutes: 5,
        questions: [expect.objectContaining({ text: 'Did you feel at ease this week?' })],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create assessment' })).toBeNull(),
    );
  });

  it('edits answer options in the scoped modal, isolated until Save', async () => {
    renderView();
    await screen.findByText('Follow-up Wellness Check');
    fireEvent.click(cardEditButtons()[1]);

    // Default mode: the standard 0–4 scale is summarised read-only.
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit question/ })[0]);
    let dialog = screen.getByRole('dialog', { name: 'Edit question 1' });
    expect(within(dialog).getByLabelText('Custom options')).not.toBeChecked();
    expect(within(dialog).getByText(/Default scale:/)).toBeInTheDocument();

    // Custom mode seeds the current default labels as editable rows.
    fireEvent.click(within(dialog).getByLabelText('Custom options'));
    expect(optionTexts(dialog)).toHaveLength(5);
    expect(optionTexts(dialog)[0].value).toBe('Never');

    // State isolation: edits live only in the modal; Cancel discards them.
    fireEvent.change(optionTexts(dialog)[0], { target: { value: 'Not at all' } });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Remove option' })[2]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Edit question 1' })).toBeNull();

    // Reopening proves nothing leaked into the parent form.
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit question/ })[0]);
    dialog = screen.getByRole('dialog', { name: 'Edit question 1' });
    expect(within(dialog).getByLabelText('Custom options')).not.toBeChecked();
    fireEvent.click(within(dialog).getByLabelText('Custom options'));
    expect(optionTexts(dialog)).toHaveLength(5);
    expect(optionTexts(dialog)[0].value).toBe('Never');

    // Customise to "Not at all → Extremely" and Save commits to the form.
    fireEvent.change(optionTexts(dialog)[0], { target: { value: 'Not at all' } });
    fireEvent.change(optionTexts(dialog)[1], { target: { value: 'Extremely' } });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Remove option' })[4]);
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Remove option' })[3]);
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Remove option' })[2]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Question' }));
    expect(screen.queryByRole('dialog', { name: 'Edit question 1' })).toBeNull();

    // Reopening shows the committed draft — the parent array was updated.
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit question/ })[0]);
    dialog = screen.getByRole('dialog', { name: 'Edit question 1' });
    expect(within(dialog).getByLabelText('Custom options')).toBeChecked();
    expect(optionTexts(dialog)).toHaveLength(2);
    expect(optionTexts(dialog)[0].value).toBe('Not at all');
    expect(optionTexts(dialog)[1].value).toBe('Extremely');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // End to end: the form Save persists text + position + options together.
    fireEvent.click(screen.getByRole('button', { name: 'Save Assessment' }));
    await waitFor(() => expect(updateAssessmentTool).toHaveBeenCalledTimes(1));
    const call = (updateAssessmentTool as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('tool-brief');
    expect(call[1].questions).toHaveLength(2);
    expect(call[1].questions[0]).toEqual(
      expect.objectContaining({
        id: 1,
        text: ORIGINAL_CALM,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Extremely' },
        ],
      }),
    );
  });

  it('validates custom answer options inside the modal', async () => {
    renderView();
    await screen.findByText('Follow-up Wellness Check');
    fireEvent.click(cardEditButtons()[1]);
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit question/ })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Edit question 1' });
    fireEvent.click(within(dialog).getByLabelText('Custom options'));

    const removals = () => within(dialog).getAllByRole('button', { name: 'Remove option' });
    const saveQuestion = () => within(dialog).getByRole('button', { name: 'Save Question' });

    // Fewer than two options blocks Save but keeps the modal open.
    fireEvent.click(removals()[2]);
    fireEvent.click(removals()[2]);
    fireEvent.click(removals()[2]);
    fireEvent.click(removals()[1]);
    expect(within(dialog).getAllByLabelText(/^Option \d+ text$/)).toHaveLength(1);
    fireEvent.click(saveQuestion());
    expect(within(dialog).getByText('A custom scale needs at least two options.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit question 1' })).toBeInTheDocument();

    // A blank label blocks Save.
    fireEvent.click(within(dialog).getByRole('button', { name: /Add option/ }));
    fireEvent.click(saveQuestion());
    expect(within(dialog).getByText('Every option needs a label.')).toBeInTheDocument();

    // Duplicate wording (case-insensitive) blocks Save.
    fireEvent.change(optionTexts(dialog)[1], { target: { value: 'never' } });
    fireEvent.click(saveQuestion());
    expect(within(dialog).getByText(/Duplicate option "never"/)).toBeInTheDocument();

    // A valid pair commits and closes.
    fireEvent.change(optionTexts(dialog)[1], { target: { value: 'Often' } });
    fireEvent.click(saveQuestion());
    expect(screen.queryByRole('dialog', { name: 'Edit question 1' })).toBeNull();
  });
});
