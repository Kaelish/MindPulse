import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import type { AppRole, StressLevel } from '../types/supabase';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

// Bands match the dashboard labels: Low 0-30, Moderate 31-60, High 61-100.
export const bandForScore = (score: number): 'low' | 'moderate' | 'high' =>
  score <= 30 ? 'low' : score <= 60 ? 'moderate' : 'high';

export interface AdminOverviewStats {
  students: number;
  doctors: number;
  admins: number;
  sessions: number;
  appointments: number;
  low: number;
  moderate: number;
  high: number;
  assessed: number;
  pendingApprovals: number;
}

interface ProfileRow {
  id: string;
  role: AppRole;
}

interface SessionRow {
  user_id: string;
  score: number | null;
  created_at: string;
}

/** Newest session per user (query must be ordered created_at desc). */
const latestSessionsByUser = <T extends { user_id: string }>(rows: T[]): Map<string, T> => {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (!latest.has(row.user_id)) latest.set(row.user_id, row);
  }
  return latest;
};

export const fetchAdminOverview = async (): Promise<AdminOverviewStats> => {
  if (!supabase) throw notConfigured();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role');
  if (profilesError) throw new Error(profilesError.message);
  const profileRows = (profiles ?? []) as ProfileRow[];

  const { data: sessions, error: sessionsError } = await supabase
    .from('stress_sessions')
    .select('user_id, score, created_at')
    .order('created_at', { ascending: false });
  if (sessionsError) throw new Error(sessionsError.message);
  const sessionRows = (sessions ?? []) as SessionRow[];

  const { count: appointmentCount, error: appointmentsError } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true });
  if (appointmentsError) throw new Error(appointmentsError.message);

  const { count: pendingCount, error: pendingError } = await supabase
    .from('doctor_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('is_verified', false);
  if (pendingError) throw new Error(pendingError.message);

  const latest = latestSessionsByUser(sessionRows);
  let low = 0;
  let moderate = 0;
  let high = 0;
  let assessed = 0;
  Array.from(latest.values()).forEach((session) => {
    if (session.score == null) return;
    assessed += 1;
    const band = bandForScore(session.score);
    if (band === 'low') low += 1;
    else if (band === 'moderate') moderate += 1;
    else high += 1;
  });

  return {
    students: profileRows.filter((row) => row.role === 'student').length,
    doctors: profileRows.filter((row) => row.role === 'doctor').length,
    admins: profileRows.filter((row) => row.role === 'admin').length,
    sessions: sessionRows.length,
    appointments: appointmentCount ?? 0,
    low,
    moderate,
    high,
    assessed,
    pendingApprovals: pendingCount ?? 0,
  };
};

export interface AdminAccountRow {
  id: string;
  name: string;
  initials: string;
  email: string;
  program: string;
  year: string;
  patients: number;
  isVerified: boolean;
  onboardingComplete: boolean;
  createdAt: string;
  latestScore: number | null;
  latestLevel: StressLevel | null;
  licenseNo: string | null;
  contactNumber: string | null;
}

interface AccountProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  program: string | null;
  year_level: string | null;
  student_no: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

const initialsOf = (name: string, email: string) => {
  const source = name || email || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
};

export const fetchAdminAccounts = async (role: 'student' | 'doctor'): Promise<AdminAccountRow[]> => {
  if (!supabase) throw notConfigured();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, program, year_level, student_no, onboarding_complete, created_at')
    .eq('role', role)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (profiles ?? []) as AccountProfileRow[];
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);

  const { data: sessions, error: sessionsError } = await supabase
    .from('stress_sessions')
    .select('user_id, score, stress_level, created_at')
    .in('user_id', ids)
    .order('created_at', { ascending: false });
  if (sessionsError) throw new Error(sessionsError.message);
  const latest = latestSessionsByUser(
    (sessions ?? []) as { user_id: string; score: number | null; stress_level: string | null; created_at: string }[],
  );

  const sessionCounts = new Map<string, number>();
  for (const row of (sessions ?? []) as SessionRow[]) {
    sessionCounts.set(row.user_id, (sessionCounts.get(row.user_id) ?? 0) + 1);
  }

  const appointmentCounts = new Map<string, number>();
  if (role === 'doctor') {
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('doctor_id')
      .in('doctor_id', ids);
    if (appointmentsError) throw new Error(appointmentsError.message);
    for (const row of (appointments ?? []) as { doctor_id: string }[]) {
      appointmentCounts.set(row.doctor_id, (appointmentCounts.get(row.doctor_id) ?? 0) + 1);
    }
  }

  let verifiedByUser = new Map<string, boolean>();
  let professionalByUser = new Map<string, { specialization: string | null; license_no: string | null; contact_number: string | null }>();
  if (role === 'doctor') {
    const { data: doctorProfiles, error: doctorProfilesError } = await supabase
      .from('doctor_profiles')
      .select('user_id, is_verified, specialization, license_no, contact_number')
      .in('user_id', ids);
    if (doctorProfilesError) throw new Error(doctorProfilesError.message);
    const doctorRows = (doctorProfiles ?? []) as {
      user_id: string;
      is_verified: boolean;
      specialization: string | null;
      license_no: string | null;
      contact_number: string | null;
    }[];
    verifiedByUser = new Map(doctorRows.map((row) => [row.user_id, row.is_verified]));
    professionalByUser = new Map(
      doctorRows.map((row) => [
        row.user_id,
        { specialization: row.specialization, license_no: row.license_no, contact_number: row.contact_number },
      ]),
    );
  }

  return rows.map((row) => {
    const name =
      `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || 'Unknown';
    const latestSession = latest.get(row.id);
    const professional = professionalByUser.get(row.id);
    return {
      id: row.id,
      name,
      initials: initialsOf(name, row.email || ''),
      email: row.email || 'No email',
      program: role === 'doctor' ? professional?.specialization || '—' : row.program || '—',
      year: row.year_level || '—',
      patients: role === 'doctor' ? appointmentCounts.get(row.id) ?? 0 : sessionCounts.get(row.id) ?? 0,
      isVerified: verifiedByUser.get(row.id) ?? false,
      onboardingComplete: row.onboarding_complete,
      createdAt: row.created_at,
      latestScore: latestSession?.score ?? null,
      latestLevel: (latestSession?.stress_level as StressLevel | null) ?? null,
      licenseNo: professional?.license_no ?? null,
      contactNumber: professional?.contact_number ?? null,
    };
  });
};

/**
 * Changes another account's role. RLS (profiles_update_self_or_admin) is the
 * real gate: non-admins get a policy violation from Supabase.
 */
export const setAccountRole = async (userId: string, role: AppRole): Promise<void> => {
  if (!supabase) throw notConfigured();
  const me = await requireUserId();
  if (me === userId) throw new Error('You cannot change your own role.');

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);

  if (role === 'doctor') {
    const { data: existing, error: lookupError } = await supabase
      .from('doctor_profiles')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (lookupError) throw new Error(lookupError.message);
    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase.from('doctor_profiles').insert({ user_id: userId });
      if (insertError) throw new Error(insertError.message);
    }
  }
};

export const setDoctorVerified = async (userId: string, verified: boolean): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase
    .from('doctor_profiles')
    .update({ is_verified: verified })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
};

/**
 * Approves a pending doctor registration (DB-side SECURITY DEFINER RPC):
 * sets doctor_profiles.is_verified = true and confirms the account's e-mail
 * so they can sign in. Admin-only — non-admin callers get a policy error.
 */
export const approveDoctor = async (userId: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase.rpc('approve_doctor', { p_user_id: userId });
  if (error) throw new Error(error.message);
};

/**
 * Denies a pending registration: removes the account entirely
 * (profiles + doctor_profiles + auth user). Admin-only RPC.
 */
export const denyDoctor = async (userId: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase.rpc('delete_app_user', { p_user_id: userId });
  if (error) throw new Error(error.message);
};

export interface AdminResultRow {
  id: string;
  studentId: string;
  studentName: string;
  score: number | null;
  stressLevel: string | null;
  heartRate: number | null;
  surveyScore: number | null;
  reactionTimeMs: number | null;
  emotion: string | null;
  faceConfidence: number | null;
  createdAt: string;
}

export const fetchAdminResults = async (): Promise<AdminResultRow[]> => {
  if (!supabase) throw notConfigured();

  const { data: sessions, error } = await supabase
    .from('stress_sessions')
    .select(
      'id, user_id, score, stress_level, heart_rate, survey_score, reaction_time_ms, emotion, face_confidence, created_at',
    )
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (sessions ?? []) as {
    id: string;
    user_id: string;
    score: number | null;
    stress_level: string | null;
    heart_rate: number | null;
    survey_score: number | null;
    reaction_time_ms: number | null;
    emotion: string | null;
    face_confidence: number | null;
    created_at: string;
  }[];
  if (!rows.length) return [];

  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', userIds);
  if (profilesError) throw new Error(profilesError.message);
  const byId = new Map(
    ((profiles ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map(
      (profile) => [profile.id, profile],
    ),
  );

  return rows.map((row) => {
    const profile = byId.get(row.user_id);
    const name = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown student'
      : 'Unknown student';
    return {
      id: row.id,
      studentId: row.user_id,
      studentName: name,
      score: row.score,
      stressLevel: row.stress_level,
      heartRate: row.heart_rate,
      surveyScore: row.survey_score,
      reactionTimeMs: row.reaction_time_ms,
      emotion: row.emotion,
      faceConfidence: row.face_confidence,
      createdAt: row.created_at,
    };
  });
};

/**
 * Same query, role-neutral name: RLS decides what comes back (administrators
 * see every row, doctors only the students they share an appointment with).
 */
export const fetchVisibleStressResults = fetchAdminResults;

export interface AdminMonthlyPoint {
  label: string;
  sessions: number;
  avgScore: number | null;
}

export interface AdminAnalytics {
  totalSessions: number;
  avgScore: number | null;
  low: number;
  moderate: number;
  high: number;
  students: number;
  assessedStudents: number;
  engagementPct: number;
  monthly: AdminMonthlyPoint[];
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fetchAdminAnalytics = async (months = 6): Promise<AdminAnalytics> => {
  if (!supabase) throw notConfigured();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role');
  if (profilesError) throw new Error(profilesError.message);
  const profileRows = (profiles ?? []) as ProfileRow[];

  const { data: sessions, error: sessionsError } = await supabase
    .from('stress_sessions')
    .select('user_id, score, created_at')
    .order('created_at', { ascending: true });
  if (sessionsError) throw new Error(sessionsError.message);
  const sessionRows = (sessions ?? []) as SessionRow[];

  const students = profileRows.filter((row) => row.role === 'student').length;
  const latest = latestSessionsByUser(sessionRows);
  let low = 0;
  let moderate = 0;
  let high = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  Array.from(latest.values()).forEach((session) => {
    if (session.score == null) return;
    const band = bandForScore(session.score);
    if (band === 'low') low += 1;
    else if (band === 'moderate') moderate += 1;
    else high += 1;
  });
  for (const session of sessionRows) {
    if (session.score == null) continue;
    scoreSum += session.score;
    scoreCount += 1;
  }

  const now = new Date();
  const buckets: { year: number; month: number; label: string }[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.push({ year: date.getFullYear(), month: date.getMonth(), label: MONTH_LABELS[date.getMonth()] });
  }

  const monthly = buckets.map((bucket) => {
    const inBucket = sessionRows.filter((row) => {
      const created = new Date(row.created_at);
      return created.getFullYear() === bucket.year && created.getMonth() === bucket.month;
    });
    const scored = inBucket.filter((row) => row.score != null);
    return {
      label: bucket.label,
      sessions: inBucket.length,
      avgScore: scored.length
        ? Math.round(scored.reduce((total, row) => total + (row.score ?? 0), 0) / scored.length)
        : null,
    };
  });

  return {
    totalSessions: sessionRows.length,
    avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    low,
    moderate,
    high,
    students,
    assessedStudents: latest.size,
    engagementPct: students ? Math.round((latest.size / students) * 100) : 0,
    monthly,
  };
};
