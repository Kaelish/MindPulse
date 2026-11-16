import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

export type AppRole = 'student' | 'doctor' | 'admin' | 'pending' | null;

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';
const NOT_SIGNED_IN = 'You must be signed in to do that.';
const SERVER_UNREACHABLE =
  'Could not reach the server to confirm your session. Check your connection and try again.';

type SessionUser = NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>['user'];

/**
 * Resolves the signed-in user without hitting `/auth/v1/user` first.
 *
 * `getSession()` reads the cached session and only talks to the network when
 * the access token is inside its expiry window (to refresh it). The JWT it
 * returns is exactly what Postgres RLS checks, so a flaky connection to the
 * auth endpoint must never be mistaken for "you were signed out".
 *
 * Returns `null` only when there is genuinely no usable session.
 */
const getLocalUser = async (): Promise<SessionUser | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;
    if (!error && session?.user?.id && session.access_token) {
      return session.user;
    }
  } catch {
    // Storage unreadable — fall through to the server check below.
  }
  return null;
};

/**
 * True when a `getUser()` failure means "there is nobody signed in" rather
 * than "we could not ask". 5xx / transport errors are indeterminate; anything
 * that actually came back from the auth API (401, bad refresh token, no
 * session at all) is a real answer.
 */
const meansSignedOut = (error: unknown): boolean => {
  if (isAuthRetryableFetchError(error)) return false;
  if (isAuthSessionMissingError(error)) return true;
  return isAuthApiError(error) && error.status < 500;
};

/**
 * Throws when nobody is signed in. Returns the authenticated user —
 * the single source of truth for "who is acting" across the services.
 *
 * Order matters: the cached session first (no network round-trip, so a blip
 * reaching the auth endpoint cannot be mistaken for "you were signed out"),
 * then the auth server as a fallback for recovering from a failed refresh.
 * Only when the server positively says "no session" do we report expiry.
 */
export const requireUser = async (): Promise<SessionUser> => {
  const local = await getLocalUser();
  if (local) return local;

  let signedOut = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return data.user;
    signedOut = error ? meansSignedOut(error) : !data.user;
  } catch (e) {
    signedOut = meansSignedOut(e);
  }

  throw new Error(signedOut ? SESSION_EXPIRED : SERVER_UNREACHABLE);
};

/** Like {@link requireUser} but returns only the id. */
export const requireUserId = async (): Promise<string> => {
  const user = await requireUser();
  return user.id;
};

/**
 * True when the failure is an authentication problem rather than a network
 * problem — callers use this to decide between "sign in again" and "retry".
 */
export const isSessionError = (e: unknown): boolean => {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return message === SESSION_EXPIRED || message === NOT_SIGNED_IN;
};

/** Message shown for an unrecoverable session; re-exported for tests. */
export const sessionExpiredMessage = SESSION_EXPIRED;
export const serverUnreachableMessage = SERVER_UNREACHABLE;

/**
 * True when the signed-in account has been deactivated (0042).
 *
 * Reads the caller's own profile row. A read failure returns false: a
 * transient error must never lock a healthy account out of the app.
 */
export const isAccountDeactivated = async (): Promise<boolean> => {
  try {
    const user = (await getLocalUser()) ?? (await requireUser());
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_deactivated')
      .eq('id', user.id)
      .maybeSingle();
    return profile?.is_deactivated === true;
  } catch {
    return false;
  }
};

/**
 * Reactivates the signed-in account (0042): clears is_deactivated,
 * deactivated_at, deleted_at and deleted_by so the account is active again.
 */
export const reactivateOwnAccount = async (): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('profiles')
    .update({
      is_deactivated: false,
      deactivated_at: null,
      deleted_at: null,
      deleted_by: null,
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
};

/**
 * Current signed-in role from profiles, or null when unavailable.
 *
 * Doctors who have not been approved by the administrator get `'pending'`:
 * the mobile portal stays locked until doctor_profiles.is_verified is true
 * (approve_doctor / admin dashboard is the only way to set it — RLS blocks
 * self-verification). Same contract as the web session service.
 */
export const getCurrentUserRole = async (): Promise<AppRole> => {
  try {
    const user = (await getLocalUser()) ?? (await requireUser());
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const role = profile?.role as 'student' | 'doctor' | 'admin' | null;
    if (role !== 'doctor') return role;
    const { data: doctor, error: doctorError } = await supabase
      .from('doctor_profiles')
      .select('is_verified')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!doctorError && doctor && doctor.is_verified === false) return 'pending';
    return 'doctor';
  } catch {
    return null;
  }
};
