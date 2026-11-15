import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { fetchAvatarUrls } from './avatars';
import type { AssessmentType } from '../types/supabase';

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
  /** Dominant emotion from the latest session's facial scan (happy / neutral / sad). */
  emotion: string | null;
  /** Facial confidence from the latest session's facial scan (0–100). */
  faceConfidence: number | null;
  /** Health background declared at onboarding (B-1); self-reported labels. */
  mentalConditions: string[];
  physicalConditions: string[];
}

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  student_no: string | null;
  program: string | null;
  year_level: string | null;
  birth_date: string | null;
  sex: string | null;
  mental_conditions: unknown;
  physical_conditions: unknown;
};

type SessionRow = {
  user_id: string;
  score: number | null;
  emotion: string | null;
  face_confidence: number | null;
  assessment_type: string | null;
  created_at: string;
};

/** Every profile column the case list and case detail share (B-1 adds the two health-background jsonb columns). Kept as one literal so the select parser keeps its row type. */
const PROFILE_COLUMNS =
  'id, first_name, last_name, email, phone, student_no, program, year_level, birth_date, sex, mental_conditions, physical_conditions';

/** jsonb string array → clean label list; legacy/garbage rows read as "none recorded". */
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

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

/** Maps one profile + its two newest DAILY sessions into the shared case record.
 *  Supplementary sessions are excluded from status/score/trend — they still
 *  feed average stress level elsewhere and remain visible in the session history. */
const buildStudentCase = (
  profile: ProfileRow,
  userSessions: SessionRow[],
  avatarUrl: string | null,
): StudentCaseRecord => {
  const name =
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown patient';

  // Keep only daily assessments for status/score/trend; supplementary sessions
  // are excluded per the daily-vs-supplementary separation.
  const dailySessions = userSessions.filter((s) => s.assessment_type === 'daily');
  const latest = dailySessions[0];
  const previous = dailySessions[1];

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
    avatarUrl,
    email: profile.email || 'No email',
    phone: profile.phone || '—',
    location: '—',
    sex: profile.sex || '—',
    program: profile.program || '—',
    year: profile.year_level || '—',
    age: formatAge(profile.birth_date),
    status,
    lastAssessment: formatDate(latest?.created_at ?? null),
    score,
    trend,
    emotion: latest?.emotion ?? null,
    faceConfidence: latest?.face_confidence ?? null,
    mentalConditions: toStringArray(profile.mental_conditions),
    physicalConditions: toStringArray(profile.physical_conditions),
  };
};

export async function fetchStudentCases(): Promise<StudentCaseRecord[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('role', 'student')
    .order('created_at', { ascending: true });
  if (profilesError) throw new Error(profilesError.message);

  const profileRows = (profiles ?? []) as ProfileRow[];
  if (!profileRows.length) return [];

  const avatars = await fetchAvatarUrls(profileRows.map((profile) => profile.id));

  const { data: sessions, error: sessionsError } = await supabase
    .from('stress_sessions')
    .select('user_id, score, emotion, face_confidence, assessment_type, created_at')
    .eq('is_deleted', false)
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

  return profileRows.map((profile) =>
    buildStudentCase(profile, recentByUser.get(profile.id) ?? [], avatars.get(profile.id) ?? null),
  );
}

/**
 * One student's case record — lets a doctor jump from a booking straight into
 * that patient's assessment history (old and recent sessions). Returns null
 * when the profile no longer exists. Mapping is shared with fetchStudentCases.
 */
export const fetchStudentCaseById = async (userId: string): Promise<StudentCaseRecord | null> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const profile = data as ProfileRow;

  const avatars = await fetchAvatarUrls([profile.id]);

  const { data: sessions, error: sessionsError } = await supabase
    .from('stress_sessions')
    .select('user_id, score, emotion, face_confidence, assessment_type, created_at')
    .eq('user_id', profile.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(2);
  if (sessionsError) throw new Error(sessionsError.message);

  return buildStudentCase(profile, (sessions ?? []) as SessionRow[], avatars.get(profile.id) ?? null);
};

// ---- Per-student history (visible to a doctor through the appointment link) --

/** One answered questionnaire item as stored on stress_sessions.survey_answers. */
export interface SurveyAnswerItem {
  id: number;
  text: string;
  reverse?: boolean;
  value: number;
  label: string;
}

/** Snapshot written by the patient app when an assessment is completed. */
export interface SurveyAnswerSet {
  toolId?: string;
  toolTitle?: string;
  items: SurveyAnswerItem[];
}

/** Tolerant parse of the survey_answers jsonb (null/legacy/garbage → null). */
const parseSurveyAnswers = (value: unknown): SurveyAnswerSet | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { items?: unknown; toolId?: unknown; toolTitle?: unknown };
  if (!Array.isArray(raw.items)) return null;
  const items = raw.items.filter(
    (item): item is SurveyAnswerItem =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as SurveyAnswerItem).text === 'string' &&
      typeof (item as SurveyAnswerItem).value === 'number',
  );
  if (!items.length) return null;
  return {
    toolId: typeof raw.toolId === 'string' ? raw.toolId : undefined,
    toolTitle: typeof raw.toolTitle === 'string' ? raw.toolTitle : undefined,
    items,
  };
};

export interface StudentSessionRecord {
  id: string;
  createdAt: string;
  score: number | null;
  stressLevel: string | null;
  heartRate: number | null;
  surveyScore: number | null;
  reactionTimeMs: number | null;
  emotion: string | null;
  faceConfidence: number | null;
  notes: string | null;
  /** 'daily' = multi-modal check-in; 'supplementary' = questionnaire-only. */
  assessmentType: AssessmentType | null;
  /** Raw questionnaire answers; null for sessions saved before migration 0019. */
  surveyAnswers: SurveyAnswerSet | null;
}

export const fetchStudentSessions = async (studentId: string): Promise<StudentSessionRecord[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  await requireUserId();

  const { data, error } = await supabase
    .from('stress_sessions')
    .select('id, created_at, score, stress_level, heart_rate, survey_score, reaction_time_ms, emotion, face_confidence, notes, assessment_type, survey_answers')
    .eq('user_id', studentId)
    .eq('is_deleted', false)
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
    face_confidence: number | null;
    notes: string | null;
    assessment_type: string | null;
    survey_answers: unknown;
  }[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    score: row.score,
    stressLevel: row.stress_level,
    heartRate: row.heart_rate,
    surveyScore: row.survey_score,
    reactionTimeMs: row.reaction_time_ms,
    emotion: row.emotion,
    faceConfidence: row.face_confidence,
    notes: row.notes,
    assessmentType: (row.assessment_type ?? 'daily') as AssessmentType,
    surveyAnswers: parseSurveyAnswers(row.survey_answers),
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
  /** Legacy roll-up fields. */
  summary: string;
  observations: string;
  recommendation: string;
  followUp: string | null;
  /** Therapy progress note. */
  sessionDate: string;
  sessionLocation: string;
  durationMinutes: number | null;
  clientName: string;
  clientDob: string;
  psychologist: string;
  presentingProblem: string;
  sessionContent: string;
  interventions: string;
  clientResponse: string;
  therapistObservations: string;
  mentalStatusExam: string;
  riskAssessment: string;
  diagnosticImpressions: string;
  planNextSession: string;
  returnToClinic: string;
  signature: string | null;
  signedAt: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  /** The only patient-readable part of the note — published or not, this is a doctor view. */
  patientNote: string;
  patientNotePublished: boolean;
  /** Legacy flag from before the note became doctor-only. */
  sharedWithPatient: boolean;
  updatedAt: string;
}

const STUDENT_NOTE_COLUMNS =
  'appointment_id, summary, observations, recommendation, follow_up, ' +
  'session_date, session_location, duration_minutes, client_name, client_dob, psychologist, ' +
  'presenting_problem, session_content, interventions, client_response, therapist_observations, ' +
  'mental_status_exam, risk_assessment, diagnostic_impressions, plan_next_session, return_to_clinic, ' +
  'signature, signed_at, attachment_path, attachment_name, patient_note, patient_note_published, ' +
  'shared_with_patient, updated_at';

export const fetchStudentConsultationNotes = async (
  studentId: string,
): Promise<StudentConsultationNoteRecord[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  await requireUserId();

  const { data, error } = await supabase
    .from('consultation_notes')
    .select(STUDENT_NOTE_COLUMNS)
    .eq('patient_id', studentId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as {
    appointment_id: string;
    summary: string | null;
    observations: string | null;
    recommendation: string | null;
    follow_up: string | null;
    session_date: string | null;
    session_location: string | null;
    duration_minutes: number | null;
    client_name: string | null;
    client_dob: string | null;
    psychologist: string | null;
    presenting_problem: string | null;
    session_content: string | null;
    interventions: string | null;
    client_response: string | null;
    therapist_observations: string | null;
    mental_status_exam: string | null;
    risk_assessment: string | null;
    diagnostic_impressions: string | null;
    plan_next_session: string | null;
    return_to_clinic: string | null;
    signature: string | null;
    signed_at: string | null;
    attachment_path: string | null;
    attachment_name: string | null;
    patient_note: string | null;
    patient_note_published: boolean | null;
    shared_with_patient: boolean | null;
    updated_at: string;
  }[]).map((row) => ({
    appointmentId: row.appointment_id,
    summary: row.summary ?? '',
    observations: row.observations ?? '',
    recommendation: row.recommendation ?? '',
    followUp: row.follow_up ?? null,
    sessionDate: row.session_date ?? '',
    sessionLocation: row.session_location ?? 'Virtual (Teleconsultation)',
    durationMinutes: row.duration_minutes ?? null,
    clientName: row.client_name ?? '',
    clientDob: row.client_dob ?? '',
    psychologist: row.psychologist ?? '',
    presentingProblem: row.presenting_problem ?? '',
    sessionContent: row.session_content ?? '',
    interventions: row.interventions ?? '',
    clientResponse: row.client_response ?? '',
    therapistObservations: row.therapist_observations ?? '',
    mentalStatusExam: row.mental_status_exam ?? '',
    riskAssessment: row.risk_assessment ?? '',
    diagnosticImpressions: row.diagnostic_impressions ?? '',
    planNextSession: row.plan_next_session ?? '',
    returnToClinic: row.return_to_clinic ?? '',
    signature: row.signature ?? null,
    signedAt: row.signed_at ?? null,
    attachmentPath: row.attachment_path ?? null,
    attachmentName: row.attachment_name ?? null,
    patientNote: row.patient_note ?? '',
    patientNotePublished: !!row.patient_note_published,
    sharedWithPatient: !!row.shared_with_patient,
    updatedAt: row.updated_at,
  }));
};
