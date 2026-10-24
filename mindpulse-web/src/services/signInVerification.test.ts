import { supabase } from '../supabase/client';
import {
  activeVerificationMethod,
  destinationError,
  disableVerification,
  enrollTotp,
  markContactMethodVerified,
  normalizeVerificationDestination,
  prepareSignInVerification,
  removeOtherTotpFactors,
  sendContactCode,
  VERIFICATION_METHODS,
} from './signInVerification';

jest.mock('../supabase/client', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
      getSession: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(),
      mfa: {
        getAuthenticatorAssuranceLevel: jest.fn(),
        listFactors: jest.fn(),
        unenroll: jest.fn(),
        challenge: jest.fn(),
        enroll: jest.fn(),
      },
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const client = supabase as unknown as {
  functions: { invoke: jest.Mock };
  auth: {
    getUser: jest.Mock;
    updateUser: jest.Mock;
    getSession: jest.Mock;
    verifyOtp: jest.Mock;
    signOut: jest.Mock;
    mfa: {
      getAuthenticatorAssuranceLevel: jest.Mock;
      listFactors: jest.Mock;
      unenroll: jest.Mock;
      challenge: jest.Mock;
      enroll: jest.Mock;
    };
  };
  from: jest.Mock;
  rpc: jest.Mock;
};
const mockedInvoke = client.functions.invoke;

beforeEach(() => {
  jest.clearAllMocks();
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', user_metadata: {} } },
    error: null,
  });
  client.auth.updateUser.mockResolvedValue({ error: null });
  client.auth.getSession.mockResolvedValue({ data: { session: null } });
  client.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1', nextLevel: 'aal1' },
    error: null,
  });
  client.auth.mfa.listFactors.mockResolvedValue({ data: { all: [] }, error: null });
  client.auth.mfa.unenroll.mockResolvedValue({ error: null });
  client.auth.mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null });
  client.auth.mfa.enroll.mockResolvedValue({
    data: { id: 'factor-1', totp: { qr_code: 'data:image/png;base64,qr' } },
    error: null,
  });
  client.auth.verifyOtp.mockResolvedValue({ error: null });
  client.auth.signOut.mockResolvedValue({ error: null });
  client.rpc.mockResolvedValue({ data: 0, error: null });
  client.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { role: 'student' }, error: null }),
      }),
    }),
  }));
});

test('offers QR, SMS, email and WhatsApp verification methods', () => {
  expect(VERIFICATION_METHODS.map((method) => method.id)).toEqual(['totp', 'sms', 'email', 'whatsapp']);
});

test('normalizes and validates phone destinations for SMS and WhatsApp', () => {
  expect(normalizeVerificationDestination('sms', '+63 917 123 4567')).toBe('+639171234567');
  expect(destinationError('sms', '+63 917 123 4567')).toBeNull();
  expect(destinationError('whatsapp', '09171234567')).toMatch(/international format/);
  expect(destinationError('whatsapp', '+1 (555) 010-9999')).toBeNull();
});

test('normalizes and validates email destinations', () => {
  expect(normalizeVerificationDestination('email', ' Doctor@Example.COM ')).toBe('doctor@example.com');
  expect(destinationError('email', 'doctor@example.com')).toBeNull();
  expect(destinationError('email', 'not-an-email')).toMatch(/valid email/);
});

test('recommends only the authenticator app', () => {
  expect(VERIFICATION_METHODS.filter((method) => method.recommended).map((method) => method.id)).toEqual(['totp']);
});

test('sends SMS through the verification function instead of Supabase phone MFA', async () => {
  mockedInvoke.mockResolvedValue({ data: { ok: true }, error: null });

  await sendContactCode('sms', '+63 917 123 4567');

  expect(mockedInvoke).toHaveBeenCalledWith('verification-code', {
    body: { action: 'send', channel: 'sms', destination: '+639171234567' },
  });
});

test('enabling a method turns sign-in challenges on and turning it off suppresses them', async () => {
  await markContactMethodVerified('email', ' Doctor@Example.com ');

  expect(client.auth.updateUser).toHaveBeenLastCalledWith({
    data: expect.objectContaining({
      verification_method: 'email',
      verification_disabled: false,
    }),
  });

  await disableVerification();

  expect(client.auth.updateUser).toHaveBeenLastCalledWith({
    data: expect.objectContaining({
      verification_method: 'none',
      verification_disabled: true,
    }),
  });
});

test('deletes the old authenticator through the SQL reset function when aal1 cannot', async () => {
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: 'lost-factor', factor_type: 'totp', status: 'verified' }] },
    error: null,
  });
  client.auth.mfa.unenroll.mockResolvedValue({
    error: { message: 'AAL2 session is required to unenroll a verified factor' },
  });
  client.rpc.mockResolvedValue({ data: 1, error: null });

  await expect(disableVerification()).resolves.toBe(0);

  expect(client.rpc).toHaveBeenCalledWith('reset_own_mfa_factors');
  expect(client.auth.updateUser).toHaveBeenLastCalledWith({
    data: expect.objectContaining({
      verification_method: 'none',
      verification_disabled: true,
    }),
  });
});

test('falls back to the mfa-reset function when the SQL reset function is missing', async () => {
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: 'lost-factor', factor_type: 'totp', status: 'verified' }] },
    error: null,
  });
  client.auth.mfa.unenroll.mockResolvedValue({
    error: { message: 'AAL2 session is required to unenroll a verified factor' },
  });
  client.rpc.mockResolvedValue({
    data: null,
    error: { message: 'Could not find the function public.reset_own_mfa_factors' },
  });
  mockedInvoke.mockResolvedValue({
    data: { ok: true, removed: 1, tokenHash: 'reset-token' },
    error: null,
  });

  await expect(disableVerification()).resolves.toBe(0);

  expect(mockedInvoke).toHaveBeenCalledWith('mfa-reset', { body: { action: 'reset' } });
  expect(client.auth.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'reset-token' });
});

test('surfaces the database error when the SQL reset function exists but fails', async () => {
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: 'lost-factor', factor_type: 'totp', status: 'verified' }] },
    error: null,
  });
  client.auth.mfa.unenroll.mockResolvedValue({
    error: { message: 'AAL2 session is required to unenroll a verified factor' },
  });
  client.rpc.mockResolvedValue({
    data: null,
    error: { message: 'permission denied for table mfa_factors' },
  });

  await expect(disableVerification()).rejects.toThrow(/permission denied for table mfa_factors/);
  expect(mockedInvoke).not.toHaveBeenCalled();
});

test('retries enrollment after the SQL reset function clears an old factor', async () => {
  client.auth.mfa.enroll
    .mockResolvedValueOnce({
      data: null,
      error: { message: 'AAL2 required to enroll a new factor' },
    })
    .mockResolvedValueOnce({
      data: { id: 'new-factor', totp: { qr_code: 'data:image/png;base64,new' } },
      error: null,
    });
  client.rpc.mockResolvedValue({ data: 1, error: null });

  await expect(enrollTotp()).resolves.toEqual({
    factorId: 'new-factor',
    qrCode: 'data:image/png;base64,new',
  });

  expect(client.rpc).toHaveBeenCalledWith('reset_own_mfa_factors');
  expect(client.auth.mfa.enroll).toHaveBeenCalledTimes(2);
});

test('shows the setup panel again after turning verification off, even with a leftover factor', async () => {
  client.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: 'doctor-1',
        user_metadata: { role: 'doctor', verification_disabled: true },
      },
    },
    error: null,
  });
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: 'lost-factor', factor_type: 'totp', status: 'verified' }] },
    error: null,
  });

  expect(await activeVerificationMethod()).toBeNull();
  expect(await prepareSignInVerification()).toBeNull();
});

test('challenges a doctor with an active authenticator exactly like an administrator', async () => {
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: 'doctor-1', user_metadata: { role: 'doctor' } } },
    error: null,
  });
  client.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1', nextLevel: 'aal2' },
    error: null,
  });
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] },
    error: null,
  });

  expect(await prepareSignInVerification()).toEqual({
    method: 'totp',
    destination: 'your authenticator app',
    factorId: 'factor-1',
    challengeId: 'challenge-1',
  });
});

test('always challenges an administrator with an active authenticator', async () => {
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-1', user_metadata: { role: 'admin' } } },
    error: null,
  });
  client.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
      }),
    }),
  }));
  client.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1', nextLevel: 'aal2' },
    error: null,
  });
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: 'factor-2', factor_type: 'totp', status: 'verified' }] },
    error: null,
  });

  expect(await prepareSignInVerification()).toEqual({
    method: 'totp',
    destination: 'your authenticator app',
    factorId: 'factor-2',
    challengeId: 'challenge-1',
  });
});

test('removes the old authenticator once a replacement has been verified', async () => {
  client.auth.mfa.listFactors.mockResolvedValue({
    data: {
      all: [
        { id: 'old-factor', factor_type: 'totp', status: 'verified' },
        { id: 'new-factor', factor_type: 'totp', status: 'verified' },
        { id: 'email-factor', factor_type: 'email', status: 'verified' },
      ],
    },
    error: null,
  });

  await removeOtherTotpFactors('new-factor');

  expect(client.auth.mfa.unenroll).toHaveBeenCalledTimes(1);
  expect(client.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'old-factor' });
});
