import { AppState, Platform } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

export type ProfileSessionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface ProfileLoginSession {
  id: string;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  roleLabel: string;
  signedInAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface ProfileSessionsState {
  sessions: ProfileLoginSession[];
  status: ProfileSessionStatus;
  message: string;
  notice: string;
}

const initialState: ProfileSessionsState = {
  sessions: [],
  status: 'connecting',
  message: 'Connecting to the live session service…',
  notice: '',
};
let state = initialState;
let channel: RealtimeChannel | null = null;
let sessionId = '';
let userId = '';
let roleLabel = 'MindPulse mobile';
let heartbeat: ReturnType<typeof setInterval> | undefined;
let listeners = new Set<(next: ProfileSessionsState) => void>();
let revokedIds = new Set<string>();

const emit = (patch: Partial<ProfileSessionsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
};

const broadcast = async (payload: Record<string, unknown>) => {
  if (!channel || channel.state !== 'joined') return false;
  try {
    return await channel.send({ type: 'broadcast', event: 'session-revoked', payload }) === 'ok';
  } catch {
    return false;
  }
};

const readIdentity = (token: string) => {
  const tokenPart = token.split('.')[1];
  if (!tokenPart) throw new Error('The saved login token is invalid.');
  const normalized = tokenPart.replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(globalThis.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
  return {
    sessionId: typeof payload.session_id === 'string' ? payload.session_id : `mobile-${Date.now()}`,
    userId: typeof payload.sub === 'string' ? payload.sub : '',
    signedInAt: typeof payload.iat === 'number' ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString(),
  };
};

const topicForUser = async (id: string) => {
  const input = new TextEncoder().encode(`mindpulse-sessions:${id}`);
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
    return `mindpulse-sessions:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 40)}`;
  } catch {
    return `mindpulse-sessions:${id.replace(/-/g, '')}`;
  }
};

const currentRow = (signedInAt: string): ProfileLoginSession => ({
  id: sessionId,
  deviceName: Platform.OS === 'ios' ? 'Mobile device (iOS)' : Platform.OS === 'android' ? 'Mobile device (Android)' : 'Mobile device (web)',
  browser: Platform.OS === 'ios' ? 'MindPulse iOS app' : Platform.OS === 'android' ? 'MindPulse Android app' : 'MindPulse mobile web',
  operatingSystem: Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web',
  roleLabel,
  signedInAt,
  lastActiveAt: new Date().toISOString(),
  isCurrent: true,
});

export const subscribeProfileSessions = (listener: (next: ProfileSessionsState) => void) => {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
};

export const startProfileSessionMonitor = async (label: string): Promise<() => void> => {
  if (channel) {
    await supabase.removeChannel(channel);
    channel = null;
  }
  if (heartbeat) clearInterval(heartbeat);
  roleLabel = label;
  revokedIds.clear();
  state = { ...initialState };
  listeners.forEach((listener) => listener(state));

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    emit({
      status: 'offline',
      message: error ? error.message : 'Sign in again to see the devices using this account.',
      sessions: [],
    });
    return () => undefined;
  }
  const identity = readIdentity(data.session.access_token);
  sessionId = identity.sessionId;
  userId = data.session.user.id || identity.userId;
  if (!userId) {
    emit({ status: 'offline', message: 'Your account could not be resolved for live session tracking.' });
    return () => undefined;
  }

  const own = currentRow(identity.signedInAt);
  emit({ status: 'connecting', sessions: [own], message: 'Connecting to the live session service…' });
  const topic = await topicForUser(userId);
  const activeChannel = supabase.channel(topic, { config: { presence: { key: sessionId } } });
  channel = activeChannel;
  const syncSessions = () => {
    if (channel !== activeChannel) return;
    const rows = Object.entries(activeChannel.presenceState<Record<string, unknown>>()).flatMap(([key, values]) =>
      values.map((value) => {
        const row = value as Record<string, unknown>;
        const id = typeof row.sessionId === 'string' ? row.sessionId : key;
        return {
          id,
          deviceName: typeof row.deviceName === 'string' ? row.deviceName : 'Mobile or web device',
          browser: typeof row.browser === 'string' ? row.browser : 'Unknown app',
          operatingSystem: typeof row.operatingSystem === 'string' ? row.operatingSystem : 'Unknown OS',
          roleLabel: typeof row.roleLabel === 'string' ? row.roleLabel : 'MindPulse',
          signedInAt: typeof row.signedInAt === 'string' ? row.signedInAt : new Date().toISOString(),
          lastActiveAt: typeof row.lastActiveAt === 'string' ? row.lastActiveAt : new Date().toISOString(),
          isCurrent: id === sessionId,
        };
      }),
    );
    if (!rows.some((row) => row.isCurrent)) rows.push(currentRow(identity.signedInAt));
    rows.sort((a, b) => a.isCurrent === b.isCurrent
      ? Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt)
      : a.isCurrent ? -1 : 1);
    emit({ sessions: rows.filter((row) => row.isCurrent || !revokedIds.has(row.id)) });
  };
  const track = () => {
    if (channel !== activeChannel || activeChannel.state !== 'joined') return;
    const row = currentRow(identity.signedInAt);
    void activeChannel.track({
      sessionId: row.id,
      deviceName: row.deviceName,
      browser: row.browser,
      operatingSystem: row.operatingSystem,
      location: 'Location not shared by the mobile app',
      roleLabel: row.roleLabel,
      signedInAt: row.signedInAt,
      lastActiveAt: new Date().toISOString(),
    }).catch((cause: unknown) => console.warn('[MindPulse] mobile presence track failed', cause));
  };

  activeChannel
    .on('presence', { event: 'sync' }, syncSessions)
    .on('broadcast', { event: 'session-revoked' }, ({ payload }) => {
      if (!payload || payload.exceptSessionId === sessionId) return;
      if (payload.sessionId === '*' || payload.sessionId === sessionId) {
        void supabase.auth.signOut({ scope: 'local' });
      }
    })
    .subscribe((status) => {
      if (channel !== activeChannel) return;
      if (status === 'SUBSCRIBED') {
        emit({ status: 'live', message: '' });
        track();
        syncSessions();
        if (!heartbeat) heartbeat = setInterval(track, 25000);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        emit({ status: 'reconnecting', message: `Live session service reported "${status}".` });
      }
    });

  const appStateSubscription = AppState.addEventListener('change', (next) => {
    if (next === 'active') track();
  });
  return () => {
    appStateSubscription.remove();
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    const active = channel;
    channel = null;
    sessionId = '';
    userId = '';
    if (active) void supabase.removeChannel(active);
    state = { ...initialState, status: 'offline', message: '' };
    listeners.forEach((listener) => listener(state));
  };
};

export const revokeProfileSession = async (id: string) => {
  const notified = await broadcast({ sessionId: id });
  const { error } = await supabase.functions.invoke('profile-session-control', { body: { sessionId: id } });
  if (error && !notified) throw new Error(`This device could not be signed out: ${error.message}`);
  revokedIds.add(id);
  emit({
    sessions: state.sessions.filter((session) => session.id !== id),
    notice: error
      ? 'Device signed out live. Server token revocation is unavailable, so an existing token may remain valid until it expires.'
      : 'Device signed out and its refresh token was revoked.',
  });
};

export const revokeOtherProfileSessions = async () => {
  const otherIds = state.sessions.filter((session) => !session.isCurrent).map((session) => session.id);
  const notified = await broadcast({ sessionId: '*', exceptSessionId: sessionId });
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error && !notified) throw new Error(error.message);
  otherIds.forEach((id) => revokedIds.add(id));
  emit({
    sessions: state.sessions.filter((session) => session.isCurrent),
    notice: error
      ? 'Other devices were signed out live. Server token revocation is unavailable, so an existing token may remain valid until it expires.'
      : notified
        ? 'All other active sessions were signed out. This device stays signed in.'
        : 'Other refresh tokens were revoked. Connected devices will sign out at their next token refresh.',
  });
};
