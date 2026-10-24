import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

/**
 * Live device/session tracking for the web portals.
 *
 * Every signed-in admin or doctor tab joins one Supabase Realtime presence
 * channel, so a device shows up in "Active Login Sessions" even when the user
 * is not looking at the Security tab. The profile panel only subscribes to the
 * shared store below.
 *
 * The channel is a regular (public) Realtime channel on purpose: private
 * channels require the `realtime.messages` policy from
 * `supabase/migrations/0022_profile_sessions.sql` to be applied to the hosted
 * project, and when that migration is missing the channel fails with
 * "Live session updates are temporarily unavailable". A public channel works
 * with the publishable key alone. The topic is a SHA-256 hash of the user id so
 * the account id is not exposed in the channel name.
 */

export type ProfileSessionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface ProfileLoginSession {
  id: string;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  location: string;
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

export interface RevokeSessionResult {
  /** The refresh token was revoked on the server. */
  serverRevoked: boolean;
  /** The device turned itself off through the live channel. */
  notified: boolean;
}

const INITIAL_STATE: ProfileSessionsState = {
  sessions: [],
  status: 'connecting',
  message: 'Connecting to the live session service…',
  notice: '',
};

let state: ProfileSessionsState = INITIAL_STATE;
const listeners = new Set<(next: ProfileSessionsState) => void>();
// Sessions this device just revoked. Their presence entry can take a moment to
// disappear, so keep them hidden instead of letting the next sync re-add them.
const revokedSessionIds = new Set<string>();

let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let currentSessionId: string | null = null;
let currentUserId: string | null = null;
let currentTokenIssuedAt: string | null = null;
let roleLabel = 'MindPulse web';
let heartbeat: number | undefined;
let retryTimer: number | undefined;
let subscribeTimer: number | undefined;
let retryAttempt = 0;
let disposed = false;
let activeMonitor = 0;

/** How long a channel may stay non-joined before the UI explains the delay. */
const SUBSCRIBE_TIMEOUT_MS = 9000;
const TAB_ID_KEY = 'mindpulse.profileSessionTabId';

const emit = (patch: Partial<ProfileSessionsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
};

const publishState = () => {
  const snapshot = state;
  listeners.forEach((listener) => listener(snapshot));
};

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

const parseJwtPayload = (jwt: string): Record<string, unknown> => {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('The access token has no payload.');
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
};

/**
 * A stable id for this browser tab. Used when the access token does not expose
 * a Supabase `session_id` claim: presence and per-device sign-out still work,
 * only server-side refresh-token revocation needs the real session id.
 */
const tabFallbackId = (): string => {
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const created = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(TAB_ID_KEY, created);
    return created;
  } catch {
    // Private-mode browsers can block sessionStorage; an in-memory id is enough.
    if (!memoryTabId) memoryTabId = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return memoryTabId;
  }
};
let memoryTabId = '';

interface SessionIdentity {
  sessionId: string;
  issuedAt: string;
  userId: string | null;
  /** True when the id came from the token and can be revoked server-side. */
  hasServerSessionId: boolean;
}

/**
 * Never throws. A token that cannot be decoded still yields a usable per-tab
 * identity so the current device always shows up in Active Login Sessions.
 */
const readSessionIdentity = (jwt: string): SessionIdentity => {
  const now = new Date().toISOString();
  let payload: Record<string, unknown> = {};
  try {
    payload = parseJwtPayload(jwt);
  } catch {
    payload = {};
  }
  const serverSessionId = typeof payload.session_id === 'string' && payload.session_id ? payload.session_id : '';
  return {
    sessionId: serverSessionId || tabFallbackId(),
    issuedAt: typeof payload.iat === 'number' ? new Date(payload.iat * 1000).toISOString() : now,
    userId: typeof payload.sub === 'string' && payload.sub ? payload.sub : null,
    hasServerSessionId: Boolean(serverSessionId),
  };
};

/** The real Supabase session id, or null when the token does not expose one. */
const serverSessionId = (jwt: string): string | null => {
  try {
    const payload = parseJwtPayload(jwt);
    return typeof payload.session_id === 'string' && payload.session_id ? payload.session_id : null;
  } catch {
    return null;
  }
};

const hashTopic = async (userId: string): Promise<string> => {
  const value = `mindpulse-sessions:${userId}`;
  try {
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return `mindpulse-sessions:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 40)}`;
  } catch {
    // crypto.subtle needs a secure context; a plain http LAN preview can fall back.
    return `mindpulse-sessions:${userId.replace(/-/g, '')}`;
  }
};

interface NavigatorUAData {
  platform?: string;
  mobile?: boolean;
}

const environmentInfo = () => {
  const agent = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  const platform = uaData?.platform || '';

  const browser = /Edg\//.test(agent) ? 'Microsoft Edge'
    : /OPR\//.test(agent) ? 'Opera'
      : /Firefox\//.test(agent) ? 'Firefox'
        : /Chrome\//.test(agent) ? 'Google Chrome'
          : /Safari\//.test(agent) ? 'Safari'
            : 'Web browser';

  const mobile = uaData?.mobile ?? /Mobi|Android|iPhone|iPad|iPod/i.test(agent);
  const tablet = /iPad|Tablet/i.test(agent);
  const operatingSystem = /Windows NT/.test(agent) || /Windows/i.test(platform) ? 'Windows'
    : /Mac OS X/.test(agent) || /macOS/i.test(platform) ? 'macOS'
      : /CrOS/.test(agent) ? 'ChromeOS'
        : /Android/.test(agent) || /Android/i.test(platform) ? 'Android'
          : /iPhone|iPad|iPod/.test(agent) || /iOS/i.test(platform) ? 'iOS'
            : /Linux/.test(agent) || /Linux/i.test(platform) ? 'Linux'
              : 'Unknown OS';

  const deviceName = tablet ? `Tablet (${operatingSystem})`
    : mobile ? `Mobile device (${operatingSystem})`
      : /Windows|macOS|ChromeOS|Linux/.test(operatingSystem) ? `Laptop / desktop (${operatingSystem})`
        : 'Web device';

  let timeZone = 'Unknown time zone';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown time zone';
  } catch {
    // Intl can be unavailable in very old browsers.
  }

  return {
    browser,
    operatingSystem,
    deviceName,
    location: `${timeZone} (browser time zone)`,
  };
};

const statusMessage = (status: ProfileSessionStatus) => {
  if (status === 'live') return '';
  if (status === 'connecting') return 'Connecting to the live session service…';
  if (status === 'reconnecting') {
    return 'Live session updates are temporarily unavailable. Reconnecting automatically — this usually means the browser lost its realtime connection or the Supabase project has Realtime disabled.';
  }
  return 'Live session updates are offline. Other signed-in devices cannot appear until the realtime connection is restored.';
};

const currentRow = (): ProfileLoginSession | null => {
  if (!currentSessionId) return null;
  const info = environmentInfo();
  const tracked = state.sessions.find((session) => session.id === currentSessionId);
  return {
    id: currentSessionId,
    deviceName: info.deviceName,
    browser: info.browser,
    operatingSystem: info.operatingSystem,
    ipAddress: 'Not shared by browsers',
    location: info.location,
    roleLabel,
    signedInAt: currentTokenIssuedAt ?? new Date().toISOString(),
    lastActiveAt: tracked?.lastActiveAt ?? new Date().toISOString(),
    isCurrent: true,
  };
};

const presencePayload = () => {
  const row = currentRow();
  if (!row) return null;
  return {
    sessionId: row.id,
    deviceName: row.deviceName,
    browser: row.browser,
    operatingSystem: row.operatingSystem,
    location: row.location,
    roleLabel: row.roleLabel,
    signedInAt: row.signedInAt,
    lastActiveAt: new Date().toISOString(),
  };
};

const syncSessions = () => {
  if (!channel) return;
  const states = channel.presenceState<Record<string, unknown>>();
  const rows = Object.entries(states).flatMap(([key, values]) => values.map((value) => {
    const item = value as Record<string, unknown>;
    const id = typeof item.sessionId === 'string' ? item.sessionId : key;
    return {
      id,
      deviceName: typeof item.deviceName === 'string' ? item.deviceName : 'Web device',
      browser: typeof item.browser === 'string' ? item.browser : 'Web browser',
      operatingSystem: typeof item.operatingSystem === 'string' ? item.operatingSystem : 'Unknown OS',
      ipAddress: 'Not shared by browsers',
      location: typeof item.location === 'string' ? item.location : 'Unknown time zone',
      roleLabel: typeof item.roleLabel === 'string' ? item.roleLabel : 'MindPulse web',
      signedInAt: typeof item.signedInAt === 'string' ? item.signedInAt : new Date().toISOString(),
      lastActiveAt: typeof item.lastActiveAt === 'string' ? item.lastActiveAt : new Date().toISOString(),
      isCurrent: id === currentSessionId,
    } satisfies ProfileLoginSession;
  }));

  // The current tab is always listed even before the first presence sync, so
  // the panel never says "waiting for devices" on the device you are using.
  const own = currentRow();
  if (own && !rows.some((row) => row.id === own.id)) rows.push(own);

  const presentIds = new Set(rows.map((row) => row.id));
  revokedSessionIds.forEach((id) => {
    if (!presentIds.has(id)) revokedSessionIds.delete(id);
  });

  const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values())
    .filter((row) => row.isCurrent || !revokedSessionIds.has(row.id));
  uniqueRows.sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
    return new Date(right.lastActiveAt).getTime() - new Date(left.lastActiveAt).getTime();
  });
  emit({ sessions: uniqueRows });
};

const canSendOnChannel = () => Boolean(channel && channel.state === 'joined');

const broadcast = async (payload: Record<string, unknown>): Promise<boolean> => {
  if (!channel || !canSendOnChannel()) return false;
  try {
    const status = await channel.send({ type: 'broadcast', event: 'session-revoked', payload });
    return status === 'ok';
  } catch {
    return false;
  }
};

const trackNow = (attempt = 0) => {
  if (!channel) return;
  if (!canSendOnChannel()) {
    // The channel may still be finishing its join; retry briefly instead of
    // silently failing to publish this device.
    if (attempt < 3) {
      window.setTimeout(() => {
        if (!disposed) trackNow(attempt + 1);
      }, 400);
    }
    return;
  }
  const payload = presencePayload();
  if (!payload) return;
  void channel.track(payload).then((status) => {
    if (status !== 'ok') console.warn('[MindPulse] presence track returned', status);
  }).catch((cause: unknown) => {
    console.warn('[MindPulse] presence track failed', cause);
  });
};

/**
 * Supabase rotates the session id when a user re-authenticates (for example
 * the password re-check in Security). Follow the new id so the presence entry
 * does not become a stale ghost device.
 */
const refreshSessionIdentity = async () => {
  if (!client || disposed) return;
  try {
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const parsed = readSessionIdentity(token);
    if (parsed.sessionId !== currentSessionId) {
      currentSessionId = parsed.sessionId;
      currentTokenIssuedAt = parsed.issuedAt;
      await openChannel();
    }
  } catch {
    // Leave the current identity in place if the token is unreadable.
  }
};

const clearTimers = () => {
  if (heartbeat !== undefined) window.clearInterval(heartbeat);
  if (retryTimer !== undefined) window.clearTimeout(retryTimer);
  if (subscribeTimer !== undefined) window.clearTimeout(subscribeTimer);
  heartbeat = undefined;
  retryTimer = undefined;
  subscribeTimer = undefined;
};

const teardownChannel = async () => {
  clearTimers();
  const active = channel;
  channel = null;
  if (!active || !client) return;
  try {
    if (active.state === 'joined') await active.untrack();
    await client.removeChannel(active);
  } catch {
    // The socket may already be gone.
  }
};

const scheduleRetry = (message?: string) => {
  if (disposed || retryTimer !== undefined) return;
  retryAttempt += 1;
  const delay = Math.min(30000, 2000 * 2 ** Math.min(retryAttempt - 1, 4));
  emit({ status: 'reconnecting', message: message ?? statusMessage('reconnecting') });
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    void openChannel();
  }, delay);
};

const openChannel = async () => {
  if (disposed || !client || !currentUserId) return;
  await teardownChannel();
  if (disposed) return;
  const topic = await hashTopic(currentUserId);
  const nextChannel = client.channel(topic, {
    config: { presence: { key: currentSessionId ?? currentUserId } },
  });
  channel = nextChannel;

  nextChannel
    .on('presence', { event: 'sync' }, syncSessions)
    .on('broadcast', { event: 'session-revoked' }, ({ payload }) => {
      if (!payload) return;
      if (payload.exceptSessionId === currentSessionId) return;
      const target = payload.sessionId;
      if (target !== '*' && target !== currentSessionId) return;
      // Another signed-in device of this account ended this session. Drop the
      // local tokens immediately; the App's auth listener returns to sign-in.
      void client?.auth.signOut({ scope: 'local' });
    });

  emit({ status: 'connecting', message: statusMessage('connecting') });
  if (subscribeTimer !== undefined) window.clearTimeout(subscribeTimer);
  subscribeTimer = window.setTimeout(() => {
    subscribeTimer = undefined;
    if (disposed || channel !== nextChannel) return;
    if (nextChannel.state === 'joined') return;
    emit({
      status: 'reconnecting',
      message: 'The live session service did not connect within 9 seconds. Check that Realtime is enabled for the Supabase project and that this browser/network allows WebSocket connections.',
    });
  }, SUBSCRIBE_TIMEOUT_MS);

  nextChannel.subscribe((status) => {
    if (disposed || channel !== nextChannel) return;
    if (status === 'SUBSCRIBED') {
      if (subscribeTimer !== undefined) {
        window.clearTimeout(subscribeTimer);
        subscribeTimer = undefined;
      }
      retryAttempt = 0;
      emit({ status: 'live', message: '' });
      trackNow();
      syncSessions();
      if (heartbeat === undefined) {
        heartbeat = window.setInterval(() => {
          if (isVisible()) void refreshSessionIdentity().then(() => trackNow());
        }, 25000);
      }
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (subscribeTimer !== undefined) {
        window.clearTimeout(subscribeTimer);
        subscribeTimer = undefined;
      }
      const detail = `The live session service reported "${status}". Reconnecting automatically.`;
      emit({ status: 'reconnecting', message: detail });
      scheduleRetry(detail);
    }
  });
};

const sendRevoked = async (sessionId: string, exceptSessionId?: string): Promise<boolean> => {
  const payload: Record<string, unknown> = { sessionId };
  if (exceptSessionId) payload.exceptSessionId = exceptSessionId;
  return broadcast(payload);
};

/**
 * Surface a failure in the Security panel instead of leaving it stuck on
 * "Connecting". Safe to call from anywhere.
 */
export const reportProfileSessionError = (cause: unknown, context = 'Live session tracking'): void => {
  const detail = cause instanceof Error
    ? cause.message
    : typeof cause === 'string' && cause
      ? cause
      : 'Unknown error';
  // Keep the console copy: the panel text is what the user reports back to us.
  console.warn(`[MindPulse] ${context}:`, cause);
  emit({ status: 'offline', message: `${context} could not start: ${detail}` });
};

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);

const startMonitor = async (label: string): Promise<() => void> => {
  const token = ++activeMonitor;
  disposed = true;
  const previousChannel = channel;
  const previousClient = client;
  if (previousChannel && previousClient) {
    try {
      if (previousChannel.state === 'joined') await previousChannel.untrack();
      await previousClient.removeChannel(previousChannel);
    } catch {
      // Ignore a socket that is already closed.
    }
  }
  clearTimers();

  disposed = false;
  retryAttempt = 0;
  channel = null;
  currentSessionId = null;
  currentUserId = null;
  currentTokenIssuedAt = null;
  roleLabel = label;
  revokedSessionIds.clear();
  state = { ...INITIAL_STATE };
  publishState();

  client = supabase;
  if (!client) {
    emit({ status: 'offline', message: 'Supabase is not configured, so live sessions cannot connect.' });
    return () => undefined;
  }
  if (typeof client.channel !== 'function') {
    emit({
      status: 'offline',
      message: 'This Supabase client was created without Realtime support, so other devices cannot be listed.',
    });
    return () => undefined;
  }

  const sessionResult = await withTimeout(client.auth.getSession(), 8000);
  if (activeMonitor !== token) return () => undefined;
  if (!sessionResult) {
    emit({
      status: 'offline',
      message: 'Reading the saved login session timed out. Reload this page and try again.',
    });
    return () => undefined;
  }
  const { data: sessionData, error: sessionError } = sessionResult;
  if (sessionError || !sessionData.session) {
    emit({
      status: 'offline',
      message: sessionError
        ? `The saved login session could not be read (${sessionError.message}). Sign in again.`
        : 'Sign in again to see the devices using this account.',
    });
    return () => undefined;
  }

  // Never throws: a token without a Supabase session_id claim falls back to a
  // stable per-tab id, so this device still appears in Active Login Sessions.
  const identity = readSessionIdentity(sessionData.session.access_token);
  currentSessionId = identity.sessionId;
  currentTokenIssuedAt = identity.issuedAt;

  const own = currentRow();
  emit({
    status: 'connecting',
    message: statusMessage('connecting'),
    sessions: own ? [own] : [],
  });

  currentUserId = sessionData.session.user?.id ?? identity.userId ?? null;
  if (!currentUserId) {
    try {
      const userResult = await withTimeout(client.auth.getUser(), 8000);
      if (activeMonitor !== token) return () => undefined;
      currentUserId = userResult?.data.user?.id ?? null;
    } catch {
      currentUserId = null;
    }
  }
  if (!currentUserId) {
    emit({
      status: 'offline',
      message: 'Your account id could not be resolved, so other devices cannot be listed. Sign out and sign in again.',
    });
    return () => undefined;
  }

  await openChannel();
  if (activeMonitor !== token) return () => undefined;

  const onOnline = () => {
    if (disposed) return;
    retryAttempt = 0;
    if (channel && channel.state === 'joined') void refreshSessionIdentity().then(() => trackNow());
    else void openChannel();
  };
  const onVisible = () => {
    if (isVisible()) void refreshSessionIdentity().then(() => trackNow());
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    if (activeMonitor !== token) return;
    disposed = true;
    activeMonitor += 1;
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearTimers();
    const active = channel;
    channel = null;
    currentSessionId = null;
    currentUserId = null;
    if (active && client) {
      void (async () => {
        try {
          if (active.state === 'joined') await active.untrack();
          await client?.removeChannel(active);
        } catch {
          // Ignore.
        }
      })();
    }
    state = { ...INITIAL_STATE, status: 'offline', message: '' };
    publishState();
  };
};

/**
 * Begin tracking the signed-in web session. Safe to call more than once: the
 * previous monitor is stopped before the new one starts. Never rejects — a
 * failure is reported through the shared session state so the Security panel
 * can explain what went wrong instead of showing "Connecting" forever.
 */
export const startProfileSessionMonitor = async (label = 'MindPulse web'): Promise<() => void> => {
  try {
    return await startMonitor(label);
  } catch (cause) {
    reportProfileSessionError(cause);
    return () => undefined;
  }
};

export const subscribeProfileSessions = (listener: (next: ProfileSessionsState) => void): (() => void) => {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
};

/**
 * Revoke one device. The live broadcast runs first so a connected tab signs
 * itself out immediately; the edge function then deletes the refresh token so
 * the device cannot silently obtain a new access token. If the edge function
 * is not deployed yet the live sign-out still works.
 */
export const revokeProfileSession = async (sessionId: string): Promise<RevokeSessionResult> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  revokedSessionIds.add(sessionId);
  const notified = await sendRevoked(sessionId);

  emit({
    sessions: state.sessions.filter((session) => session.id !== sessionId),
    notice: notified
      ? 'The device was signed out live.'
      : '',
  });

  try {
    const { error } = await supabase.functions.invoke('profile-session-control', {
      body: { sessionId },
    });
    if (error) throw error;
    emit({ notice: 'The device was signed out and its refresh token was revoked.' });
    return { serverRevoked: true, notified };
  } catch (cause) {
    if (notified) {
      emit({
        notice: 'The device was signed out live. Server-side token revocation is not available on this project yet, so an already-issued token can stay valid until it expires.',
      });
      return { serverRevoked: false, notified: true };
    }
    revokedSessionIds.delete(sessionId);
    syncSessions();
    const detail = cause instanceof Error ? cause.message : 'Unknown error';
    throw new Error(`This device could not be signed out (${detail}). Make sure it is online and try again.`);
  }
};

/**
 * Sign out every other device but keep this one signed in. The native Supabase
 * call revokes the other refresh tokens; the broadcast makes connected tabs
 * return to the sign-in screen immediately instead of waiting for their next
 * token refresh.
 */
export const revokeOtherProfileSessions = async (): Promise<RevokeSessionResult> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  state.sessions.forEach((session) => {
    if (!session.isCurrent) revokedSessionIds.add(session.id);
  });

  // A wildcard broadcast without our own id would make this tab sign itself
  // out. Only broadcast when we know which session must be spared; the server
  // call below still revokes everyone else.
  const selfId = currentSessionId;
  const notified = selfId ? await sendRevoked('*', selfId) : false;

  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error && !notified) {
    revokedSessionIds.clear();
    syncSessions();
    throw new Error(error.message);
  }
  emit({
    sessions: state.sessions.filter((session) => session.isCurrent),
    notice: notified
      ? 'All other devices were signed out. This device stays signed in.'
      : 'All other refresh tokens were revoked; this device stays signed in. Connected tabs return to sign-in at their next token refresh.',
  });
  return { serverRevoked: !error, notified };
};

/**
 * Sign out only this browser session. Supabase's default signOut is global and
 * would also sign the user out on every other device, so this device's refresh
 * token is revoked through the session-control function first, then the local
 * tokens are dropped.
 */
export const signOutCurrentDevice = async (): Promise<void> => {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const id = token ? serverSessionId(token) : null;
    if (id) {
      await supabase.functions.invoke('profile-session-control', {
        body: { sessionId: id },
      });
    }
  } catch {
    // The function may not be deployed yet; still drop the local session.
  }
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Network errors must not trap the user in the portal.
  }
};


