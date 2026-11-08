/**
 * Guards the split between the tool *structure* files and the tool *copy*
 * dictionaries.
 *
 * `services/guidedExercises.ts` and `services/journal.ts` deliberately carry
 * no wording — only ids, icons, colours, seconds and field keys — so the
 * full-screen tool sheets can render in en/fil/ceb. That split is only safe
 * if the two halves stay in lockstep:
 *
 *  - every locale has copy for every exercise / journal template;
 *  - every locale's step array matches the data file's step array length
 *    (order matters: step 3's countdown comes from the data file, its text
 *    from the dictionary at the same index);
 *  - every locale's journal field keys match the data file's field keys;
 *  - the month-name array stays index-aligned with `Date#getMonth`.
 *
 * A missing or extra key in any locale fails here rather than as an English
 * string (or a crash) on a patient's screen.
 */
import { GUIDED_EXERCISES, ExerciseId } from '../services/guidedExercises';
import { JOURNAL_TEMPLATES, JournalId } from '../services/journal';
import { en } from './en';
import { fil } from './fil';
import { ceb } from './ceb';
import type { Translations } from './types';

const locales: [string, Translations][] = [
  ['en', en],
  ['fil', fil],
  ['ceb', ceb],
];

const dataExerciseIds = GUIDED_EXERCISES.map((e) => e.id as ExerciseId).sort();
const dataJournalIds = JOURNAL_TEMPLATES.map((t) => t.id).sort();

describe.each(locales)('%s tool copy', (_name, dict) => {
  const tools = dict.results.tools;

  it('has copy for exactly the exercises in the data file', () => {
    expect(Object.keys(tools.exercises).sort()).toEqual(dataExerciseIds);
  });

  it.each(GUIDED_EXERCISES)('%s step array matches the data file', (exercise) => {
    const copy = tools.exercises[exercise.id as ExerciseId];
    expect(copy.steps).toHaveLength(exercise.steps.length);
    // Every step needs non-empty wording — an empty label renders a blank stage.
    for (const step of copy.steps) {
      expect(step.label.trim()).not.toBe('');
      expect(step.text.trim()).not.toBe('');
    }
    expect(copy.title.trim()).not.toBe('');
    expect(copy.subtitle.trim()).not.toBe('');
  });

  it('has copy for exactly the journal templates in the data file', () => {
    expect(Object.keys(tools.journalTemplates).sort()).toEqual(dataJournalIds);
    expect(Object.keys(tools.journal.templateMeta).sort()).toEqual(dataJournalIds);
  });

  it.each(JOURNAL_TEMPLATES)('%s field keys match the data file', (template) => {
    const copy = tools.journalTemplates[template.id as JournalId];
    expect(Object.keys(copy.fields).sort()).toEqual(
      template.fields.map((f) => f.key).sort(),
    );
    expect(copy.title.trim()).not.toBe('');
    expect(copy.subtitle.trim()).not.toBe('');
    expect(tools.journal.templateMeta[template.id].trim()).not.toBe('');
  });

  it('keeps the month array index-aligned with Date#getMonth', () => {
    expect(tools.views.journal.months).toHaveLength(12);
    for (const month of tools.views.journal.months) {
      expect(month.trim()).not.toBe('');
    }
  });

  it('keeps the four box-breathing phases', () => {
    const breathe = tools.views.breathe;
    for (const phase of [breathe.phaseIn, breathe.phaseHold1, breathe.phaseOut, breathe.phaseHold2]) {
      expect(phase.label.trim()).not.toBe('');
      expect(phase.hint.trim()).not.toBe('');
    }
  });
});

describe('format placeholders', () => {
  // `{n}`-style tokens must survive translation, or `.replace()` silently
  // leaves the raw braces on screen.
  const expectations: [string, string, RegExp][] = [
    ['en', en.results.tools.player.startFmt, /\{n\}/],
    ['fil', fil.results.tools.player.startFmt, /\{n\}/],
    ['ceb', ceb.results.tools.player.startFmt, /\{n\}/],
    ['en', en.results.tools.views.exercise.stepFmt, /\{n\}.*\{m\}/],
    ['fil', fil.results.tools.views.exercise.stepFmt, /\{n\}.*\{m\}/],
    ['ceb', ceb.results.tools.views.exercise.stepFmt, /\{n\}.*\{m\}/],
    ['en', en.results.tools.views.exercise.finishedFmt, /\{title\}/],
    ['fil', fil.results.tools.views.exercise.finishedFmt, /\{title\}/],
    ['ceb', ceb.results.tools.views.exercise.finishedFmt, /\{title\}/],
    ['en', en.results.tools.views.journal.showAllFmt, /\{preview\}/],
    ['fil', fil.results.tools.views.journal.showAllFmt, /\{preview\}/],
    ['ceb', ceb.results.tools.views.journal.showAllFmt, /\{preview\}/],
    ['en', en.results.tools.views.pause.runningA11yFmt, /\{time\}/],
    ['fil', fil.results.tools.views.pause.runningA11yFmt, /\{time\}/],
    ['ceb', ceb.results.tools.views.pause.runningA11yFmt, /\{time\}/],
    ['en', en.results.tools.pause.metaFmt, /\{n\}/],
    ['fil', fil.results.tools.pause.metaFmt, /\{n\}/],
    ['ceb', ceb.results.tools.pause.metaFmt, /\{n\}/],
  ];

  it.each(expectations)('%s keeps the placeholder in %s', (_locale, value, pattern) => {
    expect(value).toMatch(pattern);
  });

  it.each(locales)('%s interpolates every {n} body/kicker format', (_name, dict) => {
    const pause = dict.results.tools.views.pause;
    expect(pause.headSubFmt).toMatch(/\{n\}/);
    expect(pause.body.idleFmt).toMatch(/\{n\}/);
    expect(pause.body.leadinFmt).toMatch(/\{n\}/);
    expect(pause.body.pausedFmt).toMatch(/\{n\}/);
  });
});
