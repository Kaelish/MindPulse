import { supabase } from '../supabase/client';
import { requireUserId } from './session';

/**
 * Version of the consent text the person agrees to. Bump it whenever the
 * wording in the face-scan privacy sheet or the sign-up forms changes, so the
 * register can tell which copy of the text a given proof refers to.
 */
export const CONSENT_VERSION = '1.0';

/**
 * Writes the face-scan consent given at the privacy sheet's
 * "I Understand & Continue" button (module M-04, build B-3).
 *
 * Returns true when a new proof was filed and false when one is already on
 * file for this version: the sheet is shown before every scan, so the write
 * has to be idempotent or the register would collect one row per scan.
 *
 * Registration consent is NOT written here -- the sign-up checkbox only puts
 * `consent_source` into the signUp() metadata and migration 0031 files the
 * proof from a database trigger, because right after signUp() there may be no
 * session yet (e-mail confirmation).
 */
export const recordFaceScanConsent = async (): Promise<boolean> => {
  const userId = await requireUserId();

  // One proof per (account, type, version). Withdrawal is a deferred build,
  // so nothing can set withdrawn_at yet; a future withdrawal flow must revisit
  // this check so a re-consent after withdrawal is recorded again.
  const { data: existing, error: readError } = await supabase
    .from('consent_records')
    .select('id')
    .eq('user_id', userId)
    .eq('consent_type', 'face_scan')
    .eq('version', CONSENT_VERSION)
    .limit(1);
  if (readError) throw new Error(readError.message);
  if ((existing ?? []).length > 0) return false;

  const { error } = await supabase.from('consent_records').insert({
    user_id: userId,
    consent_type: 'face_scan',
    version: CONSENT_VERSION,
    source: 'mobile_face_scan',
  });
  if (error) throw new Error(error.message);
  return true;
};
