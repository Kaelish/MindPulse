import { supabase } from '../supabase/client';
import { ProfileLabel, fetchProfileLabels } from './admin';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

/** Consent types recorded in `consent_records` (migration 0031). */
export const CONSENT_TYPES = ['registration', 'face_scan'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export interface ConsentRecord {
  id: string;
  userId: string;
  /** Resolved from profiles; `Unknown account` when the account is gone (C-14 keeps the proof). */
  userName: string;
  userEmail: string;
  consentType: string;
  version: string;
  grantedAt: string;
  /** Always null until a withdrawal flow ships (deferred, see migration 0031). */
  withdrawnAt: string | null;
  source: string;
}

interface ConsentRow {
  id: string;
  user_id: string;
  consent_type: string;
  version: string;
  granted_at: string;
  withdrawn_at: string | null;
  source: string;
}

const PAGE_SIZE = 1000;

/** Newest first, paged: PostgREST caps a single response at 1000 rows. */
const pullRows = async (): Promise<ConsentRow[]> => {
  if (!supabase) throw notConfigured();
  const rows: ConsentRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('consent_records')
      .select('id, user_id, consent_type, version, granted_at, withdrawn_at, source')
      .order('granted_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as ConsentRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
};

/**
 * The read-only consent register (module M-04, build B-3): every proof of
 * consent in the system, newest first, with the account it belongs to.
 * RLS already restricts the read to administrators; nothing here can edit or
 * delete a row — that is the database's job (C-14).
 */
export const fetchConsentRecords = async (): Promise<ConsentRecord[]> => {
  const rows = await pullRows();
  const labels: Map<string, ProfileLabel> = await fetchProfileLabels(rows.map((row) => row.user_id));

  return rows.map((row) => {
    const label = labels.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      userName: label?.name ?? 'Unknown account',
      userEmail: label?.email ?? '',
      consentType: row.consent_type,
      version: row.version,
      grantedAt: row.granted_at,
      withdrawnAt: row.withdrawn_at,
      source: row.source,
    };
  });
};
