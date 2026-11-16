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

/** Tables that carry the is_deleted flag (0035-0039): export live rows only. */
const SOFT_DELETE_TABLES: readonly string[] = ['stress_sessions', 'notifications', 'recommendations'];

/** Tables that carry deleted_at instead (0042): export live rows only. */
const DELETED_AT_TABLES: readonly string[] = ['profiles', 'doctor_profiles', 'appointments'];

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
    let query = supabase.from(table).select('*');
    // Archived rows stay in the database but never appear in the workbook.
    if (SOFT_DELETE_TABLES.includes(table)) query = query.eq('is_deleted', false);
    else if (DELETED_AT_TABLES.includes(table)) query = query.is('deleted_at', null);
    const { data, error } = await query.limit(20000);
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
