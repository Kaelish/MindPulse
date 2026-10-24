import { supabase } from '../supabase/client';
import {
  destinationError,
  normalizeVerificationDestination,
  sendContactCode,
  VERIFICATION_METHODS,
} from './signInVerification';

jest.mock('../supabase/client', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const mockedInvoke = (supabase as unknown as { functions: { invoke: jest.Mock } }).functions.invoke;

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
