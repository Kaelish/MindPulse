import { fetchOwnProfile } from './profile';

/**
 * Cached identity for the admin sidebar account card.
 *
 * Every admin module renders its own <AdminSidebar>, so switching modules
 * unmounts and remounts the card. Without a cache the card would paint the
 * "Administrator / No email on file" placeholder first and swap in the real
 * profile a moment later, which made the whole page flash. The identity is kept
 * in module memory and mirrored to localStorage so even the first paint after a
 * reload is already correct.
 */
export interface AdminIdentity {
  name: string;
  email: string;
  administrativeTitle: string;
  preferredTitle: string;
  avatarUrl: string | null;
}

const STORAGE_KEY = 'mindpulse.adminIdentity';
export const AVATAR_STORAGE_KEY = 'mindpulse.profileAvatarUrl';

export const EMPTY_ADMIN_IDENTITY: AdminIdentity = {
  name: '',
  email: '',
  administrativeTitle: '',
  preferredTitle: '',
  avatarUrl: null,
};

let memory: AdminIdentity | null = null;
/** When the identity was last confirmed against the server (0 = never). */
let loadedAt = 0;
const FRESH_MS = 60_000;

const normalize = (value: Partial<AdminIdentity> | null | undefined): AdminIdentity => ({
  name: typeof value?.name === 'string' ? value.name : '',
  email: typeof value?.email === 'string' ? value.email : '',
  administrativeTitle: typeof value?.administrativeTitle === 'string' ? value.administrativeTitle : '',
  preferredTitle: typeof value?.preferredTitle === 'string' ? value.preferredTitle : '',
  avatarUrl: typeof value?.avatarUrl === 'string' && value.avatarUrl ? value.avatarUrl : null,
});

/** Synchronous read so the first render already shows the real profile. */
export const readCachedAdminIdentity = (): AdminIdentity | null => {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    memory = normalize(JSON.parse(raw) as Partial<AdminIdentity>);
    return memory;
  } catch {
    return null;
  }
};

export const cacheAdminIdentity = (identity: AdminIdentity): void => {
  memory = identity;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Private mode or a full quota: the in-memory copy still prevents the flash.
  }
};

/** Merge one or more changed fields into the cache and return the new value. */
export const patchCachedAdminIdentity = (patch: Partial<AdminIdentity>): AdminIdentity => {
  const next = { ...(readCachedAdminIdentity() ?? EMPTY_ADMIN_IDENTITY), ...patch };
  cacheAdminIdentity(next);
  return next;
};

export const clearAdminIdentity = (): void => {
  memory = null;
  loadedAt = 0;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(AVATAR_STORAGE_KEY);
  } catch {
    // Ignore.
  }
};

/**
 * Fetch the live profile, cache it, and return the sidebar-shaped identity.
 * A value confirmed less than a minute ago is reused so switching modules does
 * not fire a fresh request (and cannot flash) on every navigation.
 */
export const loadAdminIdentity = async (): Promise<AdminIdentity> => {
  const cached = readCachedAdminIdentity();
  if (cached && Date.now() - loadedAt < FRESH_MS) return cached;

  const profile = await fetchOwnProfile();
  const identity: AdminIdentity = {
    name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
    email: profile.email ?? '',
    administrativeTitle: profile.administrative_title?.trim() || 'Chief Clinical Administrator',
    preferredTitle: profile.preferred_title?.trim() || '',
    avatarUrl: profile.avatar_url ?? null,
  };
  cacheAdminIdentity(identity);
  loadedAt = Date.now();
  return identity;
};
