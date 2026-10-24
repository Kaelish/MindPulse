import {
  AdminIdentity,
  cacheAdminIdentity,
  clearAdminIdentity,
  EMPTY_ADMIN_IDENTITY,
  loadAdminIdentity,
  patchCachedAdminIdentity,
  readCachedAdminIdentity,
} from './adminIdentity';
import { fetchOwnProfile } from './profile';

jest.mock('./profile', () => ({
  fetchOwnProfile: jest.fn(),
}));

const identity: AdminIdentity = {
  name: 'Ada Reyes',
  email: 'ada@example.com',
  administrativeTitle: 'Chief Clinical Administrator',
  preferredTitle: 'Dr.',
  avatarUrl: null,
};

beforeEach(() => {
  clearAdminIdentity();
  window.localStorage.clear();
  jest.clearAllMocks();
});

test('has no identity before the profile is loaded', () => {
  expect(readCachedAdminIdentity()).toBeNull();
});

test('a remounted sidebar reads the cached identity synchronously', () => {
  cacheAdminIdentity(identity);

  // This is what the next module mount does: read before any network call.
  expect(readCachedAdminIdentity()).toEqual(identity);
  expect(JSON.parse(window.localStorage.getItem('mindpulse.adminIdentity') as string)).toEqual(identity);
});

test('hydrates from localStorage when module memory is empty', () => {
  window.localStorage.setItem('mindpulse.adminIdentity', JSON.stringify(identity));

  expect(readCachedAdminIdentity()?.name).toBe('Ada Reyes');
  expect(readCachedAdminIdentity()?.email).toBe('ada@example.com');
});

test('ignores malformed stored values instead of throwing', () => {
  window.localStorage.setItem('mindpulse.adminIdentity', '{not json');

  expect(readCachedAdminIdentity()).toBeNull();
});

test('patch merges only the changed fields', () => {
  cacheAdminIdentity(identity);

  const next = patchCachedAdminIdentity({ administrativeTitle: 'Clinic Director' });

  expect(next).toEqual({ ...identity, administrativeTitle: 'Clinic Director' });
  expect(readCachedAdminIdentity()).toEqual(next);
});

test('clear removes both the memory and storage copies', () => {
  cacheAdminIdentity(identity);
  clearAdminIdentity();

  expect(readCachedAdminIdentity()).toBeNull();
  expect(window.localStorage.getItem('mindpulse.adminIdentity')).toBeNull();
});

test('loadAdminIdentity maps the profile row into the sidebar shape and caches it', async () => {
  (fetchOwnProfile as jest.Mock).mockResolvedValue({
    first_name: 'Ada',
    last_name: 'Reyes',
    email: 'ada@example.com',
    avatar_url: 'https://example.com/a.png',
    administrative_title: '  ',
    preferred_title: 'Dr.',
  });

  const loaded = await loadAdminIdentity();

  expect(loaded).toEqual({
    name: 'Ada Reyes',
    email: 'ada@example.com',
    administrativeTitle: 'Chief Clinical Administrator',
    preferredTitle: 'Dr.',
    avatarUrl: 'https://example.com/a.png',
  });
  expect(readCachedAdminIdentity()).toEqual(loaded);
});

test('the empty identity never invents a name or email', () => {
  expect(EMPTY_ADMIN_IDENTITY.name).toBe('');
  expect(EMPTY_ADMIN_IDENTITY.email).toBe('');
});

test('reuses a freshly loaded identity instead of refetching on every module switch', async () => {
  (fetchOwnProfile as jest.Mock).mockResolvedValue({
    first_name: 'Ada',
    last_name: 'Reyes',
    email: 'ada@example.com',
    avatar_url: null,
    administrative_title: 'Director',
    preferred_title: '',
  });

  await loadAdminIdentity();
  await loadAdminIdentity();
  await loadAdminIdentity();

  expect(fetchOwnProfile).toHaveBeenCalledTimes(1);
});
