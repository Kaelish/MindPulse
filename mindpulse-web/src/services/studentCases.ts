import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { fetchAvatarUrls } from './avatars';

export type StudentCaseStatus = 'High Risk' | 'Moderate Risk' | 'Low Risk' | 'No Assessment';

export interface StudentCaseRecord {
  userId: string;
  name: string;
  id: string;
  initials: string;
  /** Student's profile photo; null when unset (or migration 0017 not applied). */
  avatarUrl: string | null;
  email: string;
  phone: string;
  location: string;
  sex: string;
  program: string;
  year: string;
  age: number;
  status: StudentCaseStatus;
  lastAssessment: string;
  score: number;
  trend: string;
}

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  student_no: string | null;
  program: string | null;
  year_level: string | null;
  birth_date: string | null;
  sex: string | null;
};

type SessionRow = {
  user_id: string;
  score: number | null;
  created_at: string;
};

const formatAge = (birthDate: string | null) => {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  const today = new Date();
  return Math.max(
    0,
    today.getFullYear() -
      birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0),
  );
};

// Bands match dashboard levelForScore (High > 60, Moderate > 35, Low <= 35)
const statusForScore = (score: number): StudentCaseStatus =>
  score > 60 ? 'High Risk' : score > 35 ? 'Moderate Risk' : 'Low Risk';

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No assessment';

export async function fetchStudentCases(): Promise<StudentCaseRecord[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, student_no, program, year_level, birth_date, sex')
    .eq('role', 'student')
    .order('created_at', { ascending: true });
  if (profilesError) throw new Error(profilesError.message);

  const profileRows = (profiles ?? []) as ProfileRow[];
  if (!profileRows.length) return [];

  const avatars = await fetchAvatarUrls(profileRows.map((profile) => profile.id));

  const { data: sessions, error: sessionsError } = await supabase
    .from('stress_sessions')
    .select('user_id, score, created_at')
    .order('created_at', { ascending: false });
  if (sessionsError) throw new Error(sessionsError.message);

  // Newest-first list: keep the first two sessions per user for trend.
  const recentByUser = new Map<string, SessionRow[]>();
  for (const session of (sessions ?? []) as SessionRow[]) {
    const list = recentByUser.get(session.user_id) ?? [];
    if (list.length < 2) {
      list.push(session);
      recentByUser.set(session.user_id, list);
    }
  }

  return profileRows.map((profile) => {
    const name =
      `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown student';
    const userSessions = recentByUser.get(profile.id) ?? [];
    const latest = userSessions[0];
    const previous = userSessions[1];

    const score = latest?.score ?? 0;
    const status: StudentCaseStatus = latest ? statusForScore(score) : 'No Assessment';

    let trend = 'Stable';
    if (latest && previous && latest.score != null && previous.score != null) {
      const delta = latest.score - previous.score;
      trend = delta > 2 ? 'Increasing' : delta < -2 ? 'Decreasing' : 'Stable';
    }

    return {
      userId: profile.id,
      name,
      id: profile.student_no || profile.id.slice(0, 8).toUpperCase(),
      initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      avatarUrl: avatars.get(profile.id) ?? null,
      email: profile.email || 'No email',
      phone: '—',
      location: '—',
      sex: profile.sex || '—',
      program: profile.program || '—',
      year: profile.year_level || '—',
      age: formatAge(profile.birth_date),
      status,
      lastAssessment: formatDate(latest?.created_at ?? null),
      score,
      trend,
    };
  });
}

// ---- Per-student history (visible to a doctor through the appointment link) --

export interface StudentSessionRecord {
  id: string;
  createdAt: string;
  score: number | null;
  stressLevel: string | null;
  heartRate: number | null;
  surveyScore: number | null;
  reactionTimeMs: number | null;
  emotion: string | null;
  notes: string | null;
}

export const fetchStudentSessions = async (studentId: string): Promise<StudentSessionRecord[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  await requireUserId();

  const { data, error } = await supabase
    .from('stress_sessions')
    .select('id, created_at, score, stress_level, heart_rate, survey_score, reaction_time_ms, emotion, notes')
    .eq('user_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as {
    id: string;
    created_at: string;
    score: number | null;
    stress_level: string | null;
    heart_rate: number | null;
    survey_score: number | null;
    reaction_time_ms: number | null;
    emotion: string | null;
    notes: string | null;
  }[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    score: row.score,
    stressLevel: row.stress_level,
    heartRate: row.heart_rate,
    surveyScore: row.survey_score,
    reactionTimeMs: row.reaction_time_ms,
    emotion: row.emotion,
    notes: row.notes,
  }));
};

export interface StudentAppointmentRecord {
  id: string;
  scheduledFor: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

export const fetchStudentConsultations = async (
  studentId: string,
): Promise<StudentAppointmentRecord[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  await requireUserId();

  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_for, status, notes, created_at')
    .eq('patient_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as {
    id: string;
    scheduled_for: string | null;
    status: string;
    notes: string | null;
    created_at: string;
  }[]).map((row) => ({
    id: row.id,
    scheduledFor: row.scheduled_for,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  }));
};

export interface StudentConsultationNoteRecord {
  appointmentId: string;
  summary: string;
  observations: string;
  recommendation: string;
  followUp: string | null;
  updatedAt: string;
}

export const fetchStudentConsultationNotes = async (
  studentId: string,
): Promise<StudentConsultationNoteRecord[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  await requireUserId();

  const { data, error } = await supabase
    .from('consultation_notes')
    .select('appointment_id, summary, observations, recommendation, follow_up, updated_at')
    .eq('patient_id', studentId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as {
    appointment_id: string;
    summary: string;
    observations: string;
    recommendation: string;
    follow_up: string | null;
    updated_at: string;
  }[]).map((row) => ({
    appointmentId: row.appointment_id,
    summary: row.summary,
    observations: row.observations,
    recommendation: row.recommendation,
    followUp: row.follow_up,
    updatedAt: row.updated_at,
  }));
};
