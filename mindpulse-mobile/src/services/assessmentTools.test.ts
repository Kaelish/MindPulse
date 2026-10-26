import {
  DEFAULT_LIKERT,
  scoreToolAnswers,
  type AssessmentToolQuestion,
} from './assessmentTools';

// Scoring is pure; the Supabase client only exists for the fetch helpers in
// this module, so it is replaced before the module is loaded.
jest.mock('../supabase/client', () => ({ supabase: {} }));

const question = (overrides: Partial<AssessmentToolQuestion>): AssessmentToolQuestion => ({
  id: 1,
  text: 'Question',
  ...overrides,
});

describe('scoreToolAnswers', () => {
  it('scores the standard 0–4 Likert scale as a percentage', () => {
    const questions = [1, 2, 3, 4, 5].map((id) => question({ id }));

    expect(scoreToolAnswers(questions, { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4 })).toBe(100);
    expect(scoreToolAnswers(questions, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })).toBe(0);
    expect(scoreToolAnswers(questions, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 })).toBe(50);
  });

  it('reverse-scores PSS-style items using the maximum option', () => {
    const questions = [
      question({ id: 1, reverse: true }),
      question({ id: 2 }),
    ];

    // Reverse item answered 0 contributes 4; normal item answered 4 contributes 4.
    expect(scoreToolAnswers(questions, { 1: 0, 2: 4 })).toBe(100);
    expect(scoreToolAnswers(questions, { 1: 4, 2: 0 })).toBe(0);
    expect(scoreToolAnswers(questions, { 1: 2, 2: 2 })).toBe(50);
  });

  it('uses a tool-specific option scale instead of the default Likert scale', () => {
    const questions = [
      question({
        id: 7,
        options: [
          { value: 0, label: 'No' },
          { value: 1, label: 'Sometimes' },
          { value: 3, label: 'Always' },
        ],
      }),
    ];

    expect(scoreToolAnswers(questions, { 7: 3 })).toBe(100);
    expect(scoreToolAnswers(questions, { 7: 1 })).toBe(33);
  });

  it('treats an unanswered question as 0 and ignores unknown ids', () => {
    const questions = [question({ id: 1 }), question({ id: 2 })];

    expect(scoreToolAnswers(questions, { 1: 4, 99: 4 })).toBe(50);
  });

  it('returns 0 for an empty tool or a zero-maximum scale', () => {
    expect(scoreToolAnswers([], {})).toBe(0);
    expect(
      scoreToolAnswers(
        [question({ id: 1, options: [{ value: 0, label: 'Only' }] })],
        { 1: 0 },
      ),
    ).toBe(0);
  });

  it('exposes the default Likert scale used by unscaled tools', () => {
    expect(DEFAULT_LIKERT.map((option) => option.value)).toEqual([0, 1, 2, 3, 4]);
  });
});
