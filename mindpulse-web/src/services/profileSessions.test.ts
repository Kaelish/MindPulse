import { supabase } from '../supabase/client';
import {
  reportProfileSessionError,
  startProfileSessionMonitor,
  subscribeProfileSessions,
} from './profileSessions';

/**
 * These tests pin the behaviour the Security panel depends on: the device you
 * are using must always appear, and a broken realtime channel must never leave
 * the panel stuck on "Connecting".
 */

const mockChannel: {
  state: string;
  on: jest.Mock;
  subscribe: jest.Mock;
  track: jest.Mock;
  untrack: jest.Mock;
  send: jest.Mock;
  presenceState: jest.Mock;
} = {
  state: 'closed',
  on: jest.fn(),
  subscribe: jest.fn(),
  track: jest.fn(),
  untrack: jest.fn(),
  send: jest.fn(),
  presenceState: jest.fn(),
};

jest.mock('../supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const base64Url = (value: string) =>
  window.btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A Supabase-style token that deliberately has no `session_id` claim. */
const tokenWithoutSessionId = (sub = 'user-1') =>
  `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify({ sub, iat: 1700000000 }))}.signature`;

const mocked = supabase as unknown as {
  auth: { getSession: jest.Mock };
  channel: jest.Mock;
  removeChannel: jest.Mock;
};

beforeEach(() => {
  jest.useRealTimers();
  window.sessionStorage.clear();
  mockChannel.state = 'closed';
  mockChannel.on.mockReset().mockReturnValue(mockChannel);
  mockChannel.track.mockReset().mockResolvedValue('ok');
  mockChannel.untrack.mockReset().mockResolvedValue('ok');
  mockChannel.send.mockReset().mockResolvedValue('ok');
  mockChannel.presenceState.mockReset().mockReturnValue({});
  mockChannel.subscribe.mockReset().mockImplementation((callback: (status: string) => void) => {
    mockChannel.state = 'joined';
    callback('SUBSCRIBED');
    return mockChannel;
  });
  mocked.channel.mockReset().mockReturnValue(mockChannel);
  mocked.removeChannel.mockReset().mockResolvedValue('ok');
  mocked.auth.getSession.mockReset();
});

const latestState = () => {
  let current = { sessions: [] as Array<{ id: string; isCurrent: boolean }>, status: '', message: '', notice: '' };
  const stop = subscribeProfileSessions((next) => {
    current = next as typeof current;
  });
  stop();
  return current;
};

test('lists the current device even when the token has no session_id claim', async () => {
  mocked.auth.getSession.mockResolvedValue({
    data: { session: { access_token: tokenWithoutSessionId(), user: { id: 'user-1' } } },
    error: null,
  });

  const stop = await startProfileSessionMonitor('Admin web');
  const state = latestState();

  expect(state.status).toBe('live');
  expect(state.sessions).toHaveLength(1);
  expect(state.sessions[0].isCurrent).toBe(true);
  expect(mockChannel.track).toHaveBeenCalled();
  stop();
});

test('the fallback device id stays stable for the same tab', async () => {
  mocked.auth.getSession.mockResolvedValue({
    data: { session: { access_token: tokenWithoutSessionId(), user: { id: 'user-1' } } },
    error: null,
  });

  const first = await startProfileSessionMonitor('Admin web');
  const firstId = latestState().sessions[0].id;
  first();

  const second = await startProfileSessionMonitor('Admin web');
  const secondId = latestState().sessions[0].id;
  second();

  expect(secondId).toBe(firstId);
});

test('a channel error explains the problem instead of staying on Connecting', async () => {
  mocked.auth.getSession.mockResolvedValue({
    data: { session: { access_token: tokenWithoutSessionId(), user: { id: 'user-1' } } },
    error: null,
  });
  mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
    callback('CHANNEL_ERROR');
    return mockChannel;
  });

  const stop = await startProfileSessionMonitor('Admin web');
  const state = latestState();

  expect(state.status).toBe('reconnecting');
  expect(state.message).toContain('CHANNEL_ERROR');
  // The current device is still listed while the live channel recovers.
  expect(state.sessions).toHaveLength(1);
  stop();
});

test('an unreadable login session is reported as offline', async () => {
  mocked.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'Auth session missing!' },
  });

  const stop = await startProfileSessionMonitor('Admin web');
  const state = latestState();

  expect(state.status).toBe('offline');
  expect(state.message).toContain('Auth session missing!');
  stop();
});

test('reportProfileSessionError surfaces the underlying message', () => {
  reportProfileSessionError(new Error('boom'), 'Live session tracking');

  const state = latestState();
  expect(state.status).toBe('offline');
  expect(state.message).toContain('boom');
});
