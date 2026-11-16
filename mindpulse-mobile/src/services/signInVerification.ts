import type { Factor } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';
import { normalizePhoneNumber, validatePhoneNumber } from './internationalPhone';

export type VerificationMethod = 'totp' | 'sms' | 'email' | 'whatsapp';
export type VerificationMethodChoice = VerificationMethod | 'none';

export const VERIFICATION_METHODS: Array<{
  id: VerificationMethod;
  label: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    id: 'totp',
    label: 'Authenticator app',
    description: 'Scan a QR code with Google Authenticator, Microsoft Authenticator, or another TOTP app.',
    recommended: true,
  },
  { id: 'sms', label: 'Text message (SMS)', description: 'Receive a six-digit sign-in code by text message.' },
  { id: 'email', label: 'Email address', description: 'Receive a six-digit sign-in code at your email address.' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Receive a six-digit sign-in code in WhatsApp.' },
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
  disabled: boolean;
}

const META_METHOD = 'verification_method';
const META_DESTINATION = 'verification_destination';
const META_VERIFIED_AT = 'verification_verified_at';
const META_DISABLED = 'verification_disabled';
const SESSION_FLAG_PREFIX = 'mindpulse:verified:';
const normalizePhone = (value: string) => normalizePhoneNumber(value.replace(/[^\d+]/g, ''));

export const normalizeVerificationDestination = (method: VerificationMethod, value: string) =>
  method === 'email' ? value.trim().toLowerCase()
    : method === 'totp' ? 'Authenticator app'
      : normalizePhone(value);

export const destinationError = (method: VerificationMethod, value: string): string | null => {
  const destination = normalizeVerificationDestination(method, value);
  if (method === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(destination) ? null : 'Enter a valid email address.';
  }
  if (method === 'totp') return null;
  if (!destination) return 'Enter a phone number.';
  return validatePhoneNumber(destination);
};

const getUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Your login session has expired. Sign in again.');
  return data.user;
};

export const readVerificationProfile = async (): Promise<VerificationProfile> => {
  const user = await getUser();
  const metadata = user.user_metadata ?? {};
  const rawMethod = metadata[META_METHOD];
  return {
    method: rawMethod === 'totp' || rawMethod === 'sms' || rawMethod === 'email' || rawMethod === 'whatsapp'
      ? rawMethod : 'none',
    destination: typeof metadata[META_DESTINATION] === 'string' ? metadata[META_DESTINATION] : '',
    verifiedAt: typeof metadata[META_VERIFIED_AT] === 'string' ? metadata[META_VERIFIED_AT] : '',
    disabled: metadata[META_DISABLED] === true,
  };
};

const saveProfile = async (method: VerificationMethodChoice, destination: string, verifiedAt: string) => {
  const { error } = await supabase.auth.updateUser({
    data: {
      [META_METHOD]: method,
      [META_DESTINATION]: destination,
      [META_VERIFIED_AT]: verifiedAt,
      [META_DISABLED]: method === 'none',
    },
  });
  if (error) throw new Error(error.message);
};

const verifiedFactors = async (): Promise<Factor[]> => {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return ((data?.all ?? []) as Factor[])
    .filter((factor) => factor.status === 'verified' && factor.factor_type === 'totp')
    .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''));
};

export const activeVerificationMethod = async (): Promise<VerificationMethod | null> => {
  const profile = await readVerificationProfile();
  if (profile.disabled) return null;
  if ((await verifiedFactors()).length > 0) return 'totp';
  return profile.verifiedAt && (profile.method === 'email' || profile.method === 'sms' || profile.method === 'whatsapp')
    ? profile.method : null;
};

const resetStoredFactors = async () => {
  const { error } = await supabase.rpc('reset_own_mfa_factors');
  if (error) {
    const message = error.message ?? '';
    if (/could not find the function|does not exist|schema cache|PGRST202/i.test(message)) {
      const { data, error: functionError } = await supabase.functions.invoke('mfa-reset', { body: { action: 'reset' } });
      if (functionError) throw new Error(functionError.message);
      const payload = (data ?? {}) as { ok?: boolean; removed?: number; tokenHash?: string; error?: string };
      if (payload.ok !== true) throw new Error(payload.error || 'The saved authenticator could not be removed.');
      if (Number(payload.removed ?? 0) > 0) {
        if (!payload.tokenHash) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('The authenticator was removed. Sign in again before setting up a replacement.');
        }
        const { error: sessionError } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: payload.tokenHash,
        });
        if (sessionError) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('The authenticator was removed. Sign in again before setting up a replacement.');
        }
      }
    } else {
      throw new Error(`Could not remove the saved authenticator: ${message}`);
    }
  }
  await saveProfile('none', '', '');
};

export const enrollTotp = async () => {
  const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw new Error(listError.message);
  const unverified = (existing?.all ?? []).find((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
  if (unverified) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: unverified.id });
    if (error) throw new Error(error.message);
  }
  let result = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'MindPulse sign-in verification',
  });
  if (result.error && /aal2|assurance level/i.test(result.error.message)) {
    await resetStoredFactors();
    result = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'MindPulse sign-in verification',
    });
  }
  if (result.error) throw new Error(result.error.message);
  return { factorId: result.data.id, qrCode: result.data.totp.qr_code };
};

export const challengeFactor = async (factorId: string) => {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw new Error(error.message);
  return data.id;
};

export const verifyFactor = async (factorId: string, challengeId: string, code: string) => {
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() });
  if (error) throw new Error(error.message);
};

const invokeVerification = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('verification-code', { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context?.status === 404) {
      throw new Error('Verification service is not deployed. Deploy the verification-code Supabase function.');
    }
    if (context) {
      let payload: { error?: string; message?: string } | null = null;
      try {
        payload = await context.json() as { error?: string; message?: string };
      } catch {
        payload = null;
      }
      if (payload?.error || payload?.message) throw new Error(payload.error || payload.message);
      if (context.status === 503) {
        throw new Error('Verification delivery is not configured for this project. Configure the email, SMS, or WhatsApp provider.');
      }
    }
    throw new Error(error.message);
  }
  if (!data || data.ok !== true) throw new Error(data?.error || 'The verification code could not be sent.');
};

export const sendContactCode = async (method: VerificationMethod, destination: string) => {
  if (method === 'totp') throw new Error('Choose a message-based verification method.');
  await invokeVerification({
    action: 'send',
    channel: method,
    destination: normalizeVerificationDestination(method, destination),
  });
};

export const verifyContactCode = async (method: VerificationMethod, destination: string, code: string) => {
  if (method === 'totp') throw new Error('Choose a message-based verification method.');
  await invokeVerification({
    action: 'verify',
    channel: method,
    destination: normalizeVerificationDestination(method, destination),
    code: code.trim(),
  });
};

export const markVerificationEnabled = async (method: VerificationMethod, destination: string) => {
  await saveProfile(method, normalizeVerificationDestination(method, destination), new Date().toISOString());
};

export const disableVerification = async () => {
  const factors = await verifiedFactors();
  for (const factor of factors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error && /aal2|assurance level/i.test(error.message)) {
      await resetStoredFactors();
      return;
    }
    if (error) throw new Error(error.message);
  }
  await saveProfile('none', '', '');
};

const sessionIdFromToken = async () => {
  const { data } = await supabase.auth.getSession();
  const tokenPart = data.session?.access_token.split('.')[1];
  if (!tokenPart) return '';
  try {
    const normalized = tokenPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(globalThis.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof payload.session_id === 'string' ? payload.session_id : '';
  } catch {
    return '';
  }
};

const rememberVerifiedSession = async () => {
  const id = await sessionIdFromToken();
  if (id) await AsyncStorage.setItem(`${SESSION_FLAG_PREFIX}${id}`, '1');
};

export const prepareSignInVerification = async (): Promise<VerificationChallenge | null> => {
  const profile = await readVerificationProfile();
  if (profile.disabled || !profile.verifiedAt) return null;

  const method = await activeVerificationMethod();
  if (!method) return null;

  if (method === 'totp') {
    const factor = (await verifiedFactors())[0];
    if (!factor) return null;
    return {
      method,
      destination: 'your authenticator app',
      factorId: factor.id,
      challengeId: await challengeFactor(factor.id),
    };
  }

  const sessionId = await sessionIdFromToken();
  if (sessionId && await AsyncStorage.getItem(`${SESSION_FLAG_PREFIX}${sessionId}`)) return null;
  await sendContactCode(method, profile.destination);
  return { method, destination: profile.destination };
};

export const verifySignInChallenge = async (challenge: VerificationChallenge, code: string) => {
  if (challenge.factorId) {
    if (!challenge.challengeId) throw new Error('This verification code expired. Sign in again.');
    await verifyFactor(challenge.factorId, challenge.challengeId, code);
  } else {
    await verifyContactCode(challenge.method, challenge.destination, code);
    await rememberVerifiedSession();
  }
};

export const resendSignInChallenge = async (challenge: VerificationChallenge): Promise<VerificationChallenge> => {
  if (challenge.factorId) {
    return { ...challenge, challengeId: await challengeFactor(challenge.factorId) };
  }
  await sendContactCode(challenge.method, challenge.destination);
  return challenge;
};
