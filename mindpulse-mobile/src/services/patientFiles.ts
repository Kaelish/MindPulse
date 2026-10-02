import { supabase } from '../supabase/client';
import { requireUserId } from './session';

export type PatientFileCategory = 'prescription' | 'lab_test' | 'other_note';

export interface PatientFileCategoryOption {
  key: PatientFileCategory;
  label: string;
}

export const PATIENT_FILE_CATEGORIES: PatientFileCategoryOption[] = [
  { key: 'prescription', label: 'Prescription' },
  { key: 'lab_test', label: 'Lab test' },
  { key: 'other_note', label: 'Other note' },
];

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
const MAX_BYTES = 15 * 1024 * 1024;

const safeSegment = (value: string): string => {
  const cleaned = value.replace(/[^\w.-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  return cleaned || 'file';
};

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

export interface PatientFileUploadInput {
  patientId: string;
  category: PatientFileCategory;
  title?: string;
  file: { uri: string; name: string; mimeType?: string };
}

/**
 * Doctor-side upload: stores the file under `{patientId}/{doctorId}/…` (the
 * shape the storage RLS policy checks) and inserts the My Files row.
 * RLS on `patient_files` only lets the owning doctor insert, which is why
 * this is used from the doctor chat surface, never the patient app.
 */
export const uploadPatientFile = async (input: PatientFileUploadInput): Promise<PatientFileItem> => {
  const doctorId = await requireUserId();
  if (!input.file?.uri) throw new Error('Choose a file to upload.');

  const head = await fetch(input.file.uri, { method: 'HEAD' }).catch(() => null);
  const length = Number(head?.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) {
    throw new Error('Files must be 15 MB or smaller.');
  }

  const path = `${input.patientId}/${doctorId}/${Date.now()}_${safeSegment(input.file.name)}`;
  const response = await fetch(input.file.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: input.file.mimeType || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message || 'The file could not be uploaded. Please try again.');

  const title = (input.title ?? '').trim() || input.file.name;
  const { data, error } = await supabase
    .from('patient_files')
    .insert({
      patient_id: input.patientId,
      doctor_id: doctorId,
      category: input.category,
      title,
      file_name: input.file.name,
      storage_path: path,
      content_type: input.file.mimeType || null,
      size_bytes: blob.size > 0 ? blob.size : null,
    })
    .select('id, category, title, file_name, storage_path, content_type, size_bytes, created_at')
    .single();
  if (error) throw new Error(error.message);
  return toItem(data as PatientFileRow);
};
