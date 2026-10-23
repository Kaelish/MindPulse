import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

export interface ProfileLoginSession {
  id: string;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  location: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

let currentChannel: RealtimeChannel | null = null;
let currentSessionId: string | null = null;

const parseSessionId = (jwt: string): string => {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('The current login session could not be identified.');
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
  if (typeof payload.session_id !== 'string') throw new Error('The current login session could not be identified.');
  return payload.session_id;
};

const environmentInfo = () => {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? 'Edge'
    : /Firefox\//.test(agent) ? 'Firefox'
      : /Chrome\//.test(agent) ? 'Chrome'
        : /Safari\//.test(agent) ? 'Safari'
          : 'Browser';
  const operatingSystem = /Windows NT/.test(agent) ? 'Windows'
    : /Mac OS X/.test(agent) ? 'macOS'
      : /Android/.test(agent) ? 'Android'
        : /iPhone|iPad|iPod/.test(agent) ? 'iOS'
          : /Linux/.test(agent) ? 'Linux'
            : 'Unknown OS';
  const deviceName = /iPhone|iPad|iPod/.test(agent) ? 'Apple mobile device'
    : /Android/.test(agent) ? 'Android device'
      : /Windows|Mac OS X|Linux/.test(agent) ? 'Desktop computer'
        : 'Web device';
  return { browser, operatingSystem, deviceName };
};

export const connectProfileSessions = async (
  onSessions: (sessions: ProfileLoginSession[]) => void,
  onError: (message: string) => void,
): Promise<() => void> => {
  const client = supabase;
  if (!client) throw new Error('Supabase is not configured.');
  const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] = await Promise.all([
    client.auth.getSession(),
    client.auth.getUser(),
  ]);
  if (sessionError || userError || !sessionData.session || !userData.user) {
    throw new Error('Your login session has expired. Sign in again to manage devices.');
  }

  const sessionId = parseSessionId(sessionData.session.access_token);
  const channel = client.channel(`profile-sessions:${userData.user.id}`, {
    config: { private: true, presence: { key: sessionId } },
  });
  currentChannel = channel;
  currentSessionId = sessionId;
  const { browser, operatingSystem, deviceName } = environmentInfo();

  const publish = () => channel.track({
    sessionId,
    browser,
    operatingSystem,
    deviceName,
    lastActiveAt: new Date().toISOString(),
  });

  const syncSessions = () => {
    const states = channel.presenceState<Record<string, unknown>>();
    const rows = Object.entries(states).flatMap(([key, values]) => values.map((value) => {
      const item = value as Record<string, unknown>;
      const id = typeof item.sessionId === 'string' ? item.sessionId : key;
      return {
        id,
        deviceName: typeof item.deviceName === 'string' ? item.deviceName : 'Web device',
        browser: typeof item.browser === 'string' ? item.browser : 'Browser',
        operatingSystem: typeof item.operatingSystem === 'string' ? item.operatingSystem : 'Unknown OS',
        ipAddress: 'Unavailable in browser sessions',
        location: 'Unavailable',
        lastActiveAt: typeof item.lastActiveAt === 'string' ? item.lastActiveAt : new Date().toISOString(),
        isCurrent: id === sessionId,
      };
    }));
    const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());
    onSessions(uniqueRows.sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent)));
  };

  channel
    .on('presence', { event: 'sync' }, syncSessions)
    .on('broadcast', { event: 'session-revoked' }, async ({ payload }) => {
      if (payload?.sessionId !== sessionId && payload?.sessionId !== '*') return;
      if (payload?.exceptSessionId === sessionId) return;
      await client.auth.signOut({ scope: 'local' });
    });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void publish();
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError('Live session updates are temporarily unavailable.');
  });

  const heartbeat = window.setInterval(() => {
    if (document.visibilityState === 'visible') void publish();
  }, 30000);

  return () => {
    window.clearInterval(heartbeat);
    if (currentChannel === channel) currentChannel = null;
    if (currentSessionId === sessionId) currentSessionId = null;
    void client.removeChannel(channel);
  };
};

export const revokeProfileSession = async (sessionId: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.functions.invoke('profile-session-control', {
    body: { sessionId },
  });
  if (error) throw new Error(error.message || 'Unable to revoke this session.');
};

export const revokeOtherProfileSessions = async (): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (currentChannel && currentSessionId) {
    const status = await currentChannel.send({
      type: 'broadcast',
      event: 'session-revoked',
      payload: { sessionId: '*', exceptSessionId: currentSessionId },
    });
    if (status !== 'ok') throw new Error('Could not notify other connected sessions.');
  }
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw new Error(error.message);
};