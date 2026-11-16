import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import type { RecommendationPriority, RecommendationStatus } from '../types/supabase';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export interface DoctorRecommendation {
  id: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  category: string;
  priority: RecommendationPriority;
  note: string;
  status: RecommendationStatus;
  createdAt: string;
}

export interface RecommendationInput {
  studentId: string;
  category: string;
  priority: RecommendationPriority;
  note: string;
}

interface RecommendationRow {
  id: string;
  student_id: string;
  doctor_id: string;
  category: string;
  priority: RecommendationPriority;
  note: string;
  status: RecommendationStatus;
  created_at: string;
}

interface StudentProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  student_no: string | null;
}

/** Profiles of the students this doctor has appointments with (RLS enforces the link). */
export const fetchAppointmentStudents = async (): Promise<StudentProfileRow[]> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('patient_id')
    .eq('doctor_id', doctorId);
  if (error) throw new Error(error.message);
  const patientIds = Array.from(
    new Set(((appointments ?? []) as { patient_id: string }[]).map((row) => row.patient_id)),
  );
  if (!patientIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, student_no')
    .in('id', patientIds);
  if (profilesError) throw new Error(profilesError.message);
  return (profiles ?? []) as StudentProfileRow[];
};

const nameOf = (profile: StudentProfileRow | undefined, fallbackId: string) => {
  if (!profile) return `Patient ${fallbackId.slice(0, 8)}`;
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown patient';
};

/**
 * This doctor's recommendations, newest first. Pass `studentId` to scope the
 * list to a single student (used by the student case view).
 */
export const fetchDoctorRecommendations = async (studentId?: string): Promise<DoctorRecommendation[]> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();

  let query = supabase
    .from('recommendations')
    .select('id, student_id, doctor_id, category, priority, note, status, created_at')
    .eq('doctor_id', doctorId)
    .eq('is_deleted', false);
  if (studentId) query = query.eq('student_id', studentId);
  const { data: rows, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const recommendations = (rows ?? []) as RecommendationRow[];
  if (!recommendations.length) return [];

  const studentIds = Array.from(new Set(recommendations.map((row) => row.student_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, student_no')
    .in('id', studentIds);
  if (profilesError) throw new Error(profilesError.message);
  const byId = new Map(
    ((profiles ?? []) as StudentProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return recommendations.map((row) => {
    const profile = byId.get(row.student_id);
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: nameOf(profile, row.student_id),
      studentNo: profile?.student_no || 'No patient no.',
      category: row.category,
      priority: row.priority,
      note: row.note,
      status: row.status,
      createdAt: row.created_at,
    };
  });
};

export const createRecommendation = async (input: RecommendationInput): Promise<void> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();
  const { error } = await supabase.from('recommendations').insert({
    doctor_id: doctorId,
    student_id: input.studentId,
    category: input.category,
    priority: input.priority,
    note: input.note,
    status: 'Active',
  });
  if (error) throw new Error(error.message);
};

export const updateRecommendation = async (
  id: string,
  patch: Partial<Pick<RecommendationInput, 'category' | 'priority' | 'note'>> & {
    status?: RecommendationStatus;
  },
): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase.from('recommendations').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
};

/**
 * Soft-deletes a recommendation by setting is_deleted = true. The row is
 * preserved for audit; the doctor simply stops seeing it in the list.
 */
export const deleteRecommendation = async (id: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();
  const { error } = await supabase
    .from('recommendations')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: doctorId,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
};
