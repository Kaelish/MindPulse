import {
  destinationError,
  normalizeVerificationDestination,
  prepareSignInVerification,
  VERIFICATION_METHODS,
} from './signInVerification';
import { supabase } from '../supabase/client';

jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      mfa: { listFactors: jest.fn() },
    },
    functions: { invoke: jest.fn() },
  },
}));

describe('mobile sign-in verification options', () => {
  it('offers the same four methods as the web security settings and recommends TOTP', () => {
    expect(VERIFICATION_METHODS.map(({ id }) => id)).toEqual(['totp', 'sms', 'email', 'whatsapp']);
    expect(VERIFICATION_METHODS.find(({ id }) => id === 'totp')?.recommended).toBe(true);
  });

  it('normalizes and validates email and international phone destinations', () => {
    expect(normalizeVerificationDestination('email', '  User@Example.com ')).toBe('user@example.com');
    expect(destinationError('email', 'user@example.com')).toBeNull();
    expect(destinationError('email', 'not-an-email')).toBeTruthy();
    expect(normalizeVerificationDestination('sms', '+63 (917) 000-0000')).toBe('+639170000000');
    expect(destinationError('sms', '+639170000000')).toBeNull();
    expect(destinationError('whatsapp', '09170000000')).toBeTruthy();
  });

  it('starts the saved email challenge when a sign-in verification method is enabled', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            verification_method: 'email',
            verification_destination: 'user@example.com',
            verification_verified_at: '2026-01-01T00:00:00.000Z',
          },
        },
      },
      error: null,
    });
    (supabase.auth.mfa.listFactors as jest.Mock).mockResolvedValue({
      data: { all: [] },
      error: null,
    });
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await expect(prepareSignInVerification()).resolves.toEqual({
      method: 'email',
      destination: 'user@example.com',
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('verification-code', {
      body: { action: 'send', channel: 'email', destination: 'user@example.com' },
    });
  });
});
