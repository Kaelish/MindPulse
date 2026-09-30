import { DoctorProfileData, saveDoctorProfile } from './doctorProfile';
import { supabase } from '../supabase/client';
import { requireUserId } from './session';

jest.mock('../supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

jest.mock('./session', () => ({
  requireUserId: jest.fn(),
}));

const client = supabase as unknown as {
  from: jest.Mock;
  auth: { getUser: jest.Mock; updateUser: jest.Mock };
};
const mockedFrom = client.from;
const mockedGetUser = client.auth.getUser;
const mockedRequireUserId = requireUserId as jest.Mock;

let upserted: Record<string, unknown> | null = null;

const profile: DoctorProfileData = {
  userId: 'doc-1',
  firstName: 'Maya',
  lastName: 'Reyes',
  email: 'maya@example.com',
  phone: '09171234567',
  licenseId: 'PRC-000001',
  specialty: 'Clinical Psychologist',
  department: 'Guidance',
  yearsExperience: '6',
  startDate: '2021-03-01',
  dob: '1992-05-14',
  gender: 'Female',
  streetAddress: '12 Sampaguita St.',
  avatarUrl: null,
  isVerified: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  upserted = null;

  mockedRequireUserId.mockResolvedValue('doc-1');
  mockedGetUser.mockResolvedValue({ data: { user: { email: 'maya@example.com' } } });
  mockedFrom.mockImplementation((table: string) => ({
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
    upsert: (payload: Record<string, unknown>) => {
      if (table === 'doctor_profiles') upserted = payload;
      return Promise.resolve({ error: null });
    },
  }));
});

test('save never sends is_verified, so the admin-only guard cannot reject the save', async () => {
  const result = await saveDoctorProfile({ ...profile, isVerified: false });

  expect(result.success).toBe(true);
  expect(upserted).not.toBeNull();
  expect(upserted).not.toHaveProperty('is_verified');
  expect(upserted).toMatchObject({
    user_id: 'doc-1',
    specialization: 'Clinical Psychologist',
    contact_number: '09171234567',
    license_no: 'PRC-000001',
  });
});

test('save still writes the availability notes payload', async () => {
  const result = await saveDoctorProfile(profile);

  expect(result.success).toBe(true);
  expect(JSON.parse(String((upserted as Record<string, unknown>).availability_notes))).toEqual({
    dob: '1992-05-14',
    gender: 'Female',
    streetAddress: '12 Sampaguita St.',
    yearsExperience: '6',
    startDate: '2021-03-01',
  });
});

test('surfaces a backend rejection instead of fabricating a success', async () => {
  mockedFrom.mockImplementation((table: string) => ({
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
    upsert: () =>
      table === 'doctor_profiles'
        ? Promise.resolve({ error: { message: 'row-level security policy' } })
        : Promise.resolve({ error: null }),
  }));

  const result = await saveDoctorProfile(profile);

  expect(result.success).toBe(false);
  expect(result.message).toBe('row-level security policy');
});
