import { supabase } from '../supabase/client';

export type PatientFileCategory = 'prescription' | 'lab_test' | 'other_note';

export interface PatientFileFilter {
  key: 'all' | PatientFileCategory;
  label: string;
}

export const PATIENT_FILE_FILTERS: PatientFileFilter[] = [
  { key: 'all', label: 'All Files' },
  { key: 'prescription', label: 'Prescriptions' },
  { key: 'lab_test', label: 'Lab Tests' },
  { key: 'other_note', label: 'Other Notes' },
];

export const patientFileCategoryLabel = (category: string): string =>
  PATIENT_FILE_FILTERS.find((filter) => filter.key === category)?.label ?? 'Other Notes';

export interface PatientFileItem {
  id: string;
  category: PatientFileCategory;
  title: string;
  fileName: string;
  storagePath: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

interface PatientFileRow {
  id: string;
  category: string;
  title: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const BUCKET = 'patient-files';
const SIGNED_URL_TTL_SECONDS = 3600;

const toItem = (row: PatientFileRow): PatientFileItem => ({
  id: row.id,
  category: (row.category as PatientFileCategory) || 'other_note',
  title: row.title,
  fileName: row.file_name,
  storagePath: row.storage_path,
  contentType: row.content_type,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
});

export const formatFileSize = (bytes: number | null): string => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatFileDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

export const fetchMyFiles = async (): Promise<PatientFileItem[]> => {
  const { data, error } = await supabase
    .from('patient_files')
    .select('id, category, title, file_name, storage_path, content_type, size_bytes, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PatientFileRow[]).map(toItem);
};

export const createMyFileUrl = async (storagePath: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Unable to open this file.');
  return data.signedUrl;
};
