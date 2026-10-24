import { Factor } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

export type VerificationMethod = 'totp' | 'sms' | 'email' | 'whatsapp';
export type VerificationMethodChoice = VerificationMethod | 'none';

export interface VerificationMethodOption {
  id: VerificationMethod;
  label: string;
  shortLabel: string;
  description: string;
  destinationLabel: string;
  destinationPlaceholder: string;
  /** Highlighted in the UI as the safest option (the authenticator app). */
  recommended?: boolean;
}

export const VERIFICATION_METHODS: VerificationMethodOption[] = [
  {
    id: 'totp',
    label: 'Authenticator app (QR code)',
    shortLabel: 'QR code',
    description: 'Scan a QR code with Google Authenticator, Microsoft Authenticator, or any TOTP app. Works offline and is the strongest option.',
    destinationLabel: 'Authenticator app',
    destinationPlaceholder: '',
    recommended: true,
  },
  {
    id: 'sms',
    label: 'Text message (SMS)',
    shortLabel: 'SMS',
    description: 'Receive a six-digit code by text message. Delivered by the MindPulse verification service through Twilio.',
    destinationLabel: 'Mobile number',
    destinationPlaceholder: '+63 917 000 0000',
  },
  {
    id: 'email',
    label: 'Email address',
    shortLabel: 'Email',
    description: 'Receive a six-digit code at your work email every time you sign in on a new browser session.',
    destinationLabel: 'Email address',
    destinationPlaceholder: 'you@example.com',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    description: 'Receive a six-digit code in WhatsApp. Requires the MindPulse WhatsApp sender to be configured.',
    destinationLabel: 'WhatsApp number',
    destinationPlaceholder: '+63 917 000 0000',
  },
];

export interface VerificationChallenge {
  method: VerificationMethod;
  destination: string;
  factorId?: string;
  challengeId?: string;
}

export interface VerificationProfile {
  method: VerificationMethodChoice;
  destination: string;
  verifiedAt: string;
}

const METADATA_METHOD = 'verification_method';
const METADATA_DESTINATION = 'verification_destination';
const METADATA_VERIFIED_AT = 'verification_verified_at';
const SESSION_FLAG_PREFIX = 'mindpulse:verified:';

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');

export const normalizeVerificationDestination = (method: VerificationMethod, value: string) => {
  if (method === 'email') return value.trim().toLowerCase();
  if (method === 'totp') return 'Authenticator app';
  return normalizePhone(value);
};

export const destinationError = (method: VerificationMethod, value: string): string | null => {
  const destination = normalizeVerificationDestination(method, value);
  if (method === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(destination) ? null : 'Enter a valid email address.';
  }
  if (method === 'totp') return null;
  return /^\+[1-9]\d{7,14}$/.test(destination)
    ? null
    : 'Enter a phone number in international format, for example +639170000000.';
};

const currentUser = async () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Your login session has expired. Sign in again.');
  return data.user;
};

const metadataValue = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
};

export const readVerificationProfile = async (): Promise<VerificationProfile> => {
  const user = await currentUser();
  const metadata = user.user_metadata ?? {};
  const rawMethod = metadataValue(metadata, METADATA_METHOD);
  const method: VerificationMethodChoice =
    rawMethod === 'totp' || rawMethod === 'sms' || rawMethod === 'email' || rawMethod === 'whatsapp'
      ? rawMethod
      : 'none';
  return {
    method,
    destination: metadataValue(metadata, METADATA_DESTINATION),
    verifiedAt: metadataValue(metadata, METADATA_VERIFIED_AT),
  };
};

const saveVerificationProfile = async (
  method: VerificationMethodChoice,
  destination: string,
  verifiedAt: string,
) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.updateUser({
    data: {
      [METADATA_METHOD]: method,
      [METADATA_DESTINATION]: destination,
      [METADATA_VERIFIED_AT]: verifiedAt,
    },
  });
  if (error) throw new Error(error.message);
};

const verifiedFactors = async (): Promise<Factor[]> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  const all = (data?.all ?? []) as Factor[];
  return all.filter((factor) => factor.status === 'verified' && (factor.factor_type === 'totp' || factor.factor_type === 'phone'));
};

export const verifiedFactorFor = async (method: VerificationMethod): Promise<Factor | null> => {
  if (method !== 'totp') return null;
  const factors = await verifiedFactors();
  return factors.find((factor) => factor.factor_type === 'totp') ?? null;
};

export const activeVerificationMethod = async (): Promise<VerificationMethod | null> => {
  const factors = await verifiedFactors();
  if (factors.some((factor) => factor.factor_type === 'totp')) return 'totp';
  const profile = await readVerificationProfile();
  if (!profile.verifiedAt) return null;
  return profile.method === 'email' || profile.method === 'whatsapp' || profile.method === 'sms'
    ? profile.method
    : null;
};

/** Remove every verified factor and preferred destination. */
export const disableVerification = async () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const factors = await verifiedFactors();
  for (const factor of factors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw new Error(error.message);
  }
  await saveVerificationProfile('none', '', '');
};

export const enrollTotp = async () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw new Error(listError.message);
  const unverified = (existing?.all ?? []).find((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
  if (unverified) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: unverified.id });
    if (error) throw new Error(error.message);
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'MindPulse sign-in verification',
  });
  if (error) throw new Error(error.message);
  return { factorId: data.id, qrCode: data.totp.qr_code };
};

export const challengeFactor = async (factorId: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw new Error(error.message);
  return data.id;
};

export const verifyFactor = async (factorId: string, challengeId: string, code: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() });
  if (error) throw new Error(error.message);
};

const parseFunctionError = async (error: unknown): Promise<string> => {
  const context = (error as { context?: Response }).context;
  if (context) {
    // Check the status before reading the body: a function that was never
    // deployed answers 404 with a generic gateway message that would otherwise
    // hide the actionable "deploy the function" hint.
    if (context.status === 404) {
      return 'The verification service is not deployed. Apply supabase/migrations/0027_verification_codes.sql and deploy the verification-code function, then try again.';
    }
    try {
      const body = await context.json() as { error?: string; message?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // Response was not JSON.
    }
    if (context.status === 503) {
      return 'Verification delivery is not configured on this Supabase project yet. Set the provider secrets for the verification-code function.';
    }
  }
  return error instanceof Error ? error.message : 'The verification service is unavailable.';
};

const invokeVerificationFunction = async (body: Record<string, unknown>) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('verification-code', { body });
  if (error) throw new Error(await parseFunctionError(error));
  if (!data || data.ok !== true) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'The verification code could not be sent.');
  }
  return data as { ok: true; destination?: string; expiresIn?: number };
};

export const sendContactCode = async (method: VerificationMethod, destination: string) => {
  if (method !== 'email' && method !== 'whatsapp' && method !== 'sms') {
    throw new Error('The authenticator app does not send a code by message.');
  }
  return invokeVerificationFunction({
    action: 'send',
    channel: method,
    destination: normalizeVerificationDestination(method, destination),
  });
};

export const verifyContactCode = async (method: VerificationMethod, destination: string, code: string) => {
  return invokeVerificationFunction({
    action: 'verify',
    channel: method,
    destination: normalizeVerificationDestination(method, destination),
    code: code.trim(),
  });
};

export const markContactMethodVerified = async (method: VerificationMethod, destination: string) => {
  await saveVerificationProfile(method, normalizeVerificationDestination(method, destination), new Date().toISOString());
};

export const markFactorMethodVerified = async (method: 'totp' | 'sms', destination: string) => {
  await saveVerificationProfile(method, destination, new Date().toISOString());
};

const sessionFlagKey = (sessionId: string) => `${SESSION_FLAG_PREFIX}${sessionId}`;

const currentSessionId = async () => {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return '';
  try {
    const part = token.split('.')[1];
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof payload.session_id === 'string' ? payload.session_id : '';
  } catch {
    return '';
  }
};

const rememberSessionVerified = async () => {
  const id = await currentSessionId();
  if (id) window.sessionStorage.setItem(sessionFlagKey(id), '1');
};

const sessionAlreadyVerified = async () => {
  const id = await currentSessionId();
  return Boolean(id && window.sessionStorage.getItem(sessionFlagKey(id)));
};

/**
 * Decide whether the freshly signed-in browser session needs a verification
 * step. The authenticator app is enforced through Supabase's authenticator
 * assurance level; email, SMS and WhatsApp codes are sent through the
 * `verification-code` edge function.
 */
export const prepareSignInVerification = async (): Promise<VerificationChallenge | null> => {
  if (!supabase || typeof supabase.auth.getUser !== 'function') return null;
  const mfa = supabase.auth.mfa;
  if (!mfa || typeof mfa.getAuthenticatorAssuranceLevel !== 'function') return null;
  const { data: aal } = await mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    const factors = await verifiedFactors();
    const factor = factors.find((item) => item.factor_type === 'totp') ?? factors.find((item) => item.factor_type === 'phone');
    if (!factor) return null;
    const challengeId = await challengeFactor(factor.id);
    return {
      method: factor.factor_type === 'phone' ? 'sms' : 'totp',
      destination: factor.factor_type === 'phone'
        ? ((factor as Factor & { phone?: string }).phone ?? 'your registered mobile number')
        : 'your authenticator app',
      factorId: factor.id,
      challengeId,
    };
  }

  if (await sessionAlreadyVerified()) return null;
  const profile = await readVerificationProfile();
  if (profile.method !== 'email' && profile.method !== 'whatsapp' && profile.method !== 'sms') return null;
  if (!profile.destination || !profile.verifiedAt) return null;
  await sendContactCode(profile.method, profile.destination);
  return { method: profile.method, destination: profile.destination };
};

export const verifySignInChallenge = async (challenge: VerificationChallenge, code: string) => {
  if (challenge.factorId) {
    if (!challenge.challengeId) throw new Error('This verification challenge expired. Try signing in again.');
    await verifyFactor(challenge.factorId, challenge.challengeId, code);
    return;
  }
  await verifyContactCode(challenge.method, challenge.destination, code);
  await rememberSessionVerified();
};

export const resendSignInChallenge = async (challenge: VerificationChallenge): Promise<VerificationChallenge> => {
  if (challenge.factorId) {
    const challengeId = await challengeFactor(challenge.factorId);
    return { ...challenge, challengeId };
  }
  await sendContactCode(challenge.method, challenge.destination);
  return challenge;
};
