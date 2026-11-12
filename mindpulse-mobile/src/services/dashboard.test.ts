/**
 * Once-per-day gate, server half: the Hub and the Result screen both trust
 * `fetchTodayStressSession` to decide whether today's run is already on file.
 * Three regressions are pinned here:
 *
 *   1. the window is the device's LOCAL calendar day — building it from
 *      `date + 'T00:00:00.000Z'` hides every check-in made between local
 *      midnight and 08:00 in UTC+8;
 *   2. only the daily multi-modal run gates the day — a supplementary
 *      questionnaire saves into the same table and must neither lock the
 *      check-in nor stand in for the daily row;
 *   3. the query stays pinned to the signed-in account.
 */
import { supabase } from '../supabase/client';
import { requireUser } from './session';
import { fetchTodayStressSession } from './dashboard';

jest.mock('../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./session', () => ({ requireUser: jest.fn() }));
jest.mock('./plantProgress', () => ({ recordPlantSession: jest.fn() }));
jest.mock('./notificationPrefs', () => ({
  isNotificationEnabled: jest.fn(() => true),
  loadNotificationPrefs: jest.fn(async () => ({})),
}));

let rows: Record<string, unknown>[] = [];

const limit = jest.fn((..._args: any[]) => Promise.resolve({ data: rows, error: null }));
const order = jest.fn((..._args: any[]) => ({ limit }));
const lt = jest.fn((..._args: any[]) => ({ order }));
const gte = jest.fn((..._args: any[]) => ({ lt }));
const eq = jest.fn((..._args: any[]) => ({ gte }));
const select = jest.fn((..._args: any[]) => ({ eq }));
const mockFrom = supabase.from as jest.Mock;

/** What the daily flow writes (AssessmentResultScreen). */
const DAILY_ROW = {
  id: 'daily-1',
  score: 58,
  stress_level: 'Moderate',
  created_at: '2026-11-12T01:30:00+00:00',
  notes:
    'Complete assessment: Multi-Modal (multi-modal). HR: 75 bpm, Reaction: 400 ms, Face: sad',
  heart_rate: 75,
  survey_score: 70,
  reaction_time_ms: 400,
  emotion: 'sad',
  face_confidence: 92,
};

/** What a supplementary questionnaire writes (ToolSurveyScreen) — newer here. */
const SUPPLEMENTARY_ROW = {
  id: 'tool-1',
  score: 30,
  stress_level: 'Low',
  created_at: '2026-11-12T09:00:00+00:00',
  notes: 'Completed assessment: GAD-7',
  heart_rate: null,
  survey_score: 30,
  reaction_time_ms: null,
  emotion: null,
  face_confidence: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (requireUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
  rows = [];
  mockFrom.mockReturnValue({ select });
});

describe('fetchTodayStressSession', () => {
  it('returns the daily run even when a newer supplementary session exists today', async () => {
    // Newest first, the way `.order('created_at', { ascending: false })` returns it.
    rows = [SUPPLEMENTARY_ROW, DAILY_ROW];

    const session = await fetchTodayStressSession();

    expect(session?.id).toBe('daily-1');
    expect(session?.heartRate).toBe(75);
    expect(session?.surveyScore).toBe(70);
    expect(session?.reactionTimeMs).toBe(400);
    expect(session?.faceConfidencePercent).toBe(92);
  });

  it('returns null when today only holds a supplementary questionnaire', async () => {
    rows = [SUPPLEMENTARY_ROW];

    await expect(fetchTodayStressSession()).resolves.toBeNull();
  });

  it('returns null when nothing was saved today', async () => {
    rows = [];

    await expect(fetchTodayStressSession()).resolves.toBeNull();
  });

  it('accepts a daily row by its reaction time when the notes marker is absent', async () => {
    rows = [{ ...DAILY_ROW, notes: 'User completed analysis session.' }];

    const session = await fetchTodayStressSession();

    expect(session?.id).toBe('daily-1');
  });

  it('queries the local calendar day as UTC instants, and only for this user', async () => {
    await fetchTodayStressSession();

    expect(mockFrom).toHaveBeenCalledWith('stress_sessions');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');

    const [startColumn, startIso] = gte.mock.calls[0];
    const [endColumn, endIso] = lt.mock.calls[0];
    expect(startColumn).toBe('created_at');
    expect(endColumn).toBe('created_at');

    const now = new Date();
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    expect(new Date(startIso as string).getTime()).toBe(localMidnight.getTime());
    expect(new Date(endIso as string).getTime()).toBe(nextLocalMidnight.getTime());
    expect(new Date(endIso as string).getTime() - new Date(startIso as string).getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });
});
