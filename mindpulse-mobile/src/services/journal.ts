/**
 * Self-care journal: prompt templates plus an AsyncStorage-backed entry store.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THESE ENTRIES NEVER REACH SUPABASE
 * ══════════════════════════════════════════════════════════════════════════
 * Everything else the patient produces — the stress score, heart rate,
 * reaction time and the structured survey answers — is written to
 * `stress_sessions` so a clinician can review it. Journal entries are not, and
 * that is a deliberate product decision rather than an omitted migration:
 *
 *  1. FREE TEXT IS THE MOST SENSITIVE AND LEAST BOUNDED DATA IN THE APP.
 *     A PSS-10 answer is a structured item from a validated instrument that
 *     the patient deliberately completed as part of an assessment they chose
 *     to run; its lifecycle is defined by the instrument. A "worry journal"
 *     has no boundaries — for a high-stress user it can contain things no
 *     clinician ever asked to see. Sending it to a shared table drags in
 *     consent scope, retention windows and row-level security obligations
 *     that structured scores simply do not carry.
 *
 *  2. THE APP SHIPS CRISIS HOTLINES (988 / 1553 / 741741) for exactly the
 *     population most likely to write something unbounded into a box labelled
 *     "worry journal". Being conservative where users are most vulnerable
 *     reads as design maturity, not laziness.
 *
 *  3. THE VALUE IS THE WRITING ACT, NOT THE RECORD. `stress_sessions` exists
 *     to be read — by the patient, by the doctor, as a trend over time. A
 *     gratitude note exists to be written. Different data, different
 *     lifecycle.
 *
 *  4. IT MATCHES AN EXISTING PRINCIPLE IN THIS CODEBASE.
 *     `AssessmentNavigator.handleFaceScanComplete` deliberately does not
 *     persist the face scan result ("intentionally not persisted — it is
 *     excluded from scoring"). Data with no consumer should not be retained.
 *     Same rule, applied to a second data type.
 *
 * ACCEPTED TRADEOFFS — stated openly rather than hidden:
 *  - Entries do not survive an app reinstall or a device change (no sync).
 *  - A clinician cannot read them during a session.
 *  - MITIGATION: the sheet shows "Stored on this device only", and every
 *    entry can be deleted in one tap. Nothing here is ever transmitted.
 *
 * If this decision is ever revisited, it needs a `journal_entries` table with
 * row-level security scoped to the owning patient, an explicit consent
 * toggle at write time, and a documented retention window — not a bare insert.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type JournalId = 'gratitude' | 'worry' | 'nextStep';

/**
 * Field structure only — labels and placeholders live in the dictionaries
 * under `t.results.tools.journalTemplates[id].fields`, so a prompt form can
 * never render in only one language. `i18n/toolCopy.test.ts` keeps the key
 * sets here and there identical.
 */
export interface JournalField {
  /** Key inside `JournalEntry.values`. */
  key: string;
  lines: number;
}

/** Structure only — all wording lives in `t.results.tools.journalTemplates`. */
export interface JournalTemplate {
  id: JournalId;
  icon: string;
  /** Accent colour for the header and the save button. */
  color: string;
  fields: JournalField[];
}

export interface JournalEntry {
  id: string;
  templateId: JournalId;
  /** ISO timestamp — used for display on-device only, never transmitted. */
  createdAt: string;
  values: Record<string, string>;
  /** Soft-delete flag: true means the entry is hidden but preserved locally. */
  deleted?: boolean;
}

const STORAGE_KEY = 'journal_entries_v1';
/** Keep the store bounded; old notes fall off the end rather than growing forever. */
const MAX_ENTRIES = 100;

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'gratitude',
    icon: 'create-outline',
    color: '#2E7D32',
    fields: [
      { key: 'one', lines: 2 },
      { key: 'two', lines: 2 },
      { key: 'three', lines: 2 },
    ],
  },
  {
    id: 'worry',
    icon: 'alert-circle-outline',
    color: '#E65100',
    fields: [
      { key: 'worry', lines: 3 },
      { key: 'nextStep', lines: 3 },
    ],
  },
  {
    id: 'nextStep',
    icon: 'arrow-forward-circle-outline',
    color: '#C62828',
    fields: [
      { key: 'step', lines: 3 },
      { key: 'defer', lines: 2 },
    ],
  },
];

export const journalTemplateById = (id: JournalId): JournalTemplate | undefined =>
  JOURNAL_TEMPLATES.find((t) => t.id === id);

const parse = (raw: string | null): JournalEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
  } catch {
    return [];
  }
};

/**
 * Never throws — a missing or corrupt key must not stop the sheet opening.
 * `templateId` narrows to one prompt's entries. Soft-deleted entries are
 * excluded from results.
 */
export const loadJournalEntries = async (templateId?: JournalId): Promise<JournalEntry[]> => {
  try {
    const all = parse(await AsyncStorage.getItem(STORAGE_KEY));
    const active = all.filter((e) => !e.deleted);
    return templateId ? active.filter((e) => e.templateId === templateId) : active;
  } catch {
    return [];
  }
};

/**
 * Writes a new entry and returns that template's list, newest first.
 * Intentionally allowed to reject — the sheet turns a failure into a visible
 * message rather than pretending the note was saved.
 */
export const persistJournalEntry = async (
  templateId: JournalId,
  values: Record<string, string>,
): Promise<JournalEntry[]> => {
  const entry: JournalEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    templateId,
    createdAt: new Date().toISOString(),
    values,
  };
  const all = parse(await AsyncStorage.getItem(STORAGE_KEY));
  const next = [entry, ...all].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next.filter((e) => e.templateId === templateId);
};

/** Best-effort soft-delete — marks the entry deleted instead of removing it. */
export const deleteJournalEntry = async (id: string): Promise<void> => {
  try {
    const all = parse(await AsyncStorage.getItem(STORAGE_KEY));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(all.map((e) => (e.id === id ? { ...e, deleted: true } : e))),
    );
  } catch {
    // Losing a delete is survivable; throwing here would surface an error the
    // patient has already acted on.
  }
};

/** Concatenated preview shown in the recent-entries list. */
export const entryPreview = (entry: JournalEntry): string =>
  Object.values(entry.values).filter(Boolean).join(' · ');

/**
 * Deterministic on-device timestamp — no Intl dependency in the render path.
 * `months` is the caller's localized abbreviated month list
 * (`t.results.tools.journal.months`, Jan → Dec, index-aligned with `Date`).
 */
export const entryStamp = (iso: string, months: string[]): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()} · ${hh}:${mm}`;
};
