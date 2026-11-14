import { supabase } from '../supabase/client';
import * as XLSX from 'xlsx';

const EXPORT_TABLES = [
  'profiles',
  'doctor_profiles',
  'stress_sessions',
  'appointments',
  'notifications',
  'recommendations',
] as const;

/**
 * Downloads every admin-visible table as one Excel workbook (one sheet per
 * table). RLS decides what an administrator can read. Tables that fail are
 * listed under `errors` instead of aborting the whole export.
 */
export const exportSystemData = async (): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  const workbook = XLSX.utils.book_new();
  const errors: string[] = [];

  for (const table of EXPORT_TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(20000);
    if (error) {
      errors.push(`${table}: ${error.message}`);
    } else {
      const rows = data ?? [];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, table);
    }
  }

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `mindpulse-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
};
