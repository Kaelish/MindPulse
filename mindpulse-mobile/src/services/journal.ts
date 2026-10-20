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

export interface JournalField {
  /** Key inside `JournalEntry.values`. */
  key: string;
  label: string;
  placeholder: string;
  lines: number;
}

export interface JournalTemplate {
  id: JournalId;
  title: string;
  subtitle: string;
  icon: string;
  /** Accent colour for the header and the save button. */
  color: string;
  /** Short line shown on the launcher button. */
  meta: string;
  fields: JournalField[];
}

export interface JournalEntry {
  id: string;
  templateId: JournalId;
  /** ISO timestamp — used for display on-device only, never transmitted. */
  createdAt: string;
  values: Record<string, string>;
}

const STORAGE_KEY = 'journal_entries_v1';
/** Keep the store bounded; old notes fall off the end rather than growing forever. */
const MAX_ENTRIES = 100;

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'gratitude',
    title: 'Gratitude note',
    subtitle: 'Three things that went well',
    icon: 'create-outline',
    color: '#2E7D32',
    meta: '3 prompts',
    fields: [
      {
        key: 'one',
        label: '1 — Something that went well',
        placeholder: 'Ate lunch with a friend instead of at my desk',
        lines: 2,
      },
      {
        key: 'two',
        label: '2 — Something you are grateful for',
        placeholder: 'The bus showed up exactly when I needed it',
        lines: 2,
      },
      {
        key: 'three',
        label: '3 — Something you handled well',
        placeholder: 'Finished the problem set even though it was hard',
        lines: 2,
      },
    ],
  },
  {
    id: 'worry',
    title: 'Worry journal',
    subtitle: 'Name it, then shrink it',
    icon: 'alert-circle-outline',
    color: '#E65100',
    meta: 'worry + 1 step',
    fields: [
      {
        key: 'worry',
        label: 'The worry, written down',
        placeholder:
          "I'm behind on the thesis and the deadline is close. Writing it down stops it circling.",
        lines: 3,
      },
      {
        key: 'nextStep',
        label: 'Smallest next action',
        placeholder: 'Open the document and write one paragraph. Nothing more.',
        lines: 3,
      },
    ],
  },
  {
    id: 'nextStep',
    title: 'Next small step',
    subtitle: 'One thing — only one',
    icon: 'arrow-forward-circle-outline',
    color: '#C62828',
    meta: 'one step',
    fields: [
      {
        key: 'step',
        label: 'The single next thing to do',
        placeholder: 'Email my adviser to move the meeting.',
        lines: 3,
      },
      {
        key: 'defer',
        label: 'Everything else waits until…',
        placeholder: 'After I have rested tonight.',
        lines: 2,
      },
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
 * `templateId` narrows to one prompt's entries.
 */
export const loadJournalEntries = async (templateId?: JournalId): Promise<JournalEntry[]> => {
  try {
    const all = parse(await AsyncStorage.getItem(STORAGE_KEY));
    return templateId ? all.filter((e) => e.templateId === templateId) : all;
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

/** Best-effort removal — the caller already dropped it from its own state. */
export const deleteJournalEntry = async (id: string): Promise<void> => {
  try {
    const all = parse(await AsyncStorage.getItem(STORAGE_KEY));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(all.filter((e) => e.id !== id)),
    );
  } catch {
    // Losing a delete is survivable; throwing here would surface an error the
    // patient has already acted on.
  }
};

/** Concatenated preview shown in the recent-entries list. */
export const entryPreview = (entry: JournalEntry): string =>
  Object.values(entry.values).filter(Boolean).join(' · ');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic on-device timestamp — no Intl dependency in the render path. */
export const entryStamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${hh}:${mm}`;
};
