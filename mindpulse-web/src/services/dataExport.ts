import { supabase } from '../supabase/client';

const EXPORT_TABLES = [
  'profiles',
  'doctor_profiles',
  'stress_sessions',
  'appointments',
  'notifications',
  'recommendations',
] as const;

/**
 * Downloads every admin-visible table as one JSON file (RLS decides what an
 * administrator can read). Tables that fail are listed under `errors` instead
 * of aborting the whole export.
 */
export const exportSystemData = async (): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    source: 'MindPulse Admin Portal',
  };
  const errors: string[] = [];

  for (const table of EXPORT_TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(20000);
    if (error) errors.push(`${table}: ${error.message}`);
    else payload[table] = data ?? [];
  }
  if (errors.length) payload.errors = errors;

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `mindpulse-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
};
