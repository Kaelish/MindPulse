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

export interface PatientFileRecord {
  id: string;
  patientId: string;
  doctorId: string;
  category: PatientFileCategory;
  title: string;
  fileName: string;
  storagePath: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface PatientFileDraft {
  patientId: string;
  category: PatientFileCategory;
  title: string;
  file: File;
}

const BUCKET = 'patient-files';
const SIGNED_URL_TTL_SECONDS = 600;
const MAX_BYTES = 15 * 1024 * 1024;

interface PatientFileRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  category: string;
  title: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const toRecord = (row: PatientFileRow): PatientFileRecord => ({
  id: row.id,
  patientId: row.patient_id,
  doctorId: row.doctor_id,
  category: (row.category as PatientFileCategory) || 'other_note',
  title: row.title,
  fileName: row.file_name,
  storagePath: row.storage_path,
  contentType: row.content_type,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
});

const safeSegment = (value: string): string => {
  const cleaned = value.replace(/[^\w.-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  return cleaned || 'file';
};

const humanSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatPatientFileSize = humanSize;

export const fetchStudentFiles = async (patientId: string): Promise<PatientFileRecord[]> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  await requireUserId();
  const { data, error } = await supabase
    .from('patient_files')
    .select(
      'id, patient_id, doctor_id, category, title, file_name, storage_path, content_type, size_bytes, created_at',
    )
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PatientFileRow[]).map(toRecord);
};

export const uploadStudentFile = async (draft: PatientFileDraft): Promise<PatientFileRecord> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const doctorId = await requireUserId();
  if (!draft.file) throw new Error('Choose a file to upload.');
  if (draft.file.size > MAX_BYTES) throw new Error('Files must be 15 MB or smaller.');

  const path = `${draft.patientId}/${doctorId}/${Date.now()}_${safeSegment(draft.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, draft.file, { contentType: draft.file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const title = draft.title.trim() || draft.file.name;
  const { data, error } = await supabase
    .from('patient_files')
    .insert({
      patient_id: draft.patientId,
      doctor_id: doctorId,
      category: draft.category,
      title,
      file_name: draft.file.name,
      storage_path: path,
      content_type: draft.file.type || null,
      size_bytes: draft.file.size,
    })
    .select(
      'id, patient_id, doctor_id, category, title, file_name, storage_path, content_type, size_bytes, created_at',
    )
    .single();
  if (error) throw new Error(error.message);
  return toRecord(data as PatientFileRow);
};

/**
 * Soft-deletes a patient file row by setting is_deleted = true. The DB row is
 * preserved; the actual storage object is still removed from the bucket so
 * orphaned files don't accumulate.
 */
export const deleteStudentFile = async (file: PatientFileRecord): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  await requireUserId();
  const { error } = await supabase
    .from('patient_files')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', file.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BUCKET).remove([file.storagePath]).catch(() => undefined);
};

export const createStudentFileUrl = async (storagePath: string): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Unable to open this file.');
  return data.signedUrl;
};
