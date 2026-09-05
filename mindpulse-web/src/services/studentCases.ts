import { supabase } from '../supabase/client';

export type StudentCaseStatus = 'High Risk' | 'Moderate Risk' | 'Low Risk';

export interface StudentCaseRecord {
  name: string;
  id: string;
  initials: string;
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

type UserRow = { USER_ID: string; FIRST_NAME: string; LAST_NAME: string; EMAIL: string; ROLE: string };
type ProfileRow = { USER_ID: string; STUDENT_NO: string; COURSE: string | null; YEAR_LEVEL: number | null; BIRTH_DATE: string | null; SEX: string | null };
type SessionRow = { USER_ID: string; STARTED_AT: string | null; OVERALL_STRESS_SCORE: number | null; OVERALL_STRESS_LEVEL: string | null };

const formatAge = (birthDate: string | null) => {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  const today = new Date();
  return Math.max(0, today.getFullYear() - birth.getFullYear() - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0));
};

const toStatus = (level: string | null, score: number) => {
  const normalized = String(level || '').toLowerCase();
  if (normalized.includes('high') || score >= 61) return 'High Risk' as const;
  if (normalized.includes('moderate') || score >= 31) return 'Moderate Risk' as const;
  return 'Low Risk' as const;
};

const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No assessment';

export async function fetchStudentCases(): Promise<StudentCaseRecord[]> {
  if (!supabase) throw new Error('Supabase is not configured. Showing sample cases.');

  const { data: users, error: usersError } = await supabase
    .from('USER')
    .select('USER_ID, FIRST_NAME, LAST_NAME, EMAIL, ROLE')
    .ilike('ROLE', '%student%');
  if (usersError) throw new Error(usersError.message);

  const userRows = (users || []) as UserRow[];
  if (!userRows.length) return [];
  const userIds = userRows.map((user) => user.USER_ID);

  const [{ data: profiles, error: profilesError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from('STUDENT_PROFILES').select('USER_ID, STUDENT_NO, COURSE, YEAR_LEVEL, BIRTH_DATE, SEX').in('USER_ID', userIds),
    supabase.from('ASSESSMENT_SESSIONS').select('USER_ID, STARTED_AT, OVERALL_STRESS_SCORE, OVERALL_STRESS_LEVEL').in('USER_ID', userIds).order('STARTED_AT', { ascending: false }),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (sessionsError) throw new Error(sessionsError.message);

  const profileByUser = new Map(((profiles || []) as ProfileRow[]).map((profile) => [profile.USER_ID, profile]));
  const latestSessionByUser = new Map<string, SessionRow>();
  for (const session of (sessions || []) as SessionRow[]) {
    if (!latestSessionByUser.has(session.USER_ID)) latestSessionByUser.set(session.USER_ID, session);
  }

  return userRows.map((user) => {
    const profile = profileByUser.get(user.USER_ID);
    const session = latestSessionByUser.get(user.USER_ID);
    const name = `${user.FIRST_NAME || ''} ${user.LAST_NAME || ''}`.trim() || user.EMAIL;
    const score = session?.OVERALL_STRESS_SCORE ?? 0;
    const status = toStatus(session?.OVERALL_STRESS_LEVEL || null, score);
    return {
      name,
      id: profile?.STUDENT_NO || user.USER_ID.slice(0, 8).toUpperCase(),
      initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      email: user.EMAIL,
      phone: 'Not provided',
      location: 'Not provided',
      sex: profile?.SEX || 'Not provided',
      program: profile?.COURSE || 'Not provided',
      year: profile?.YEAR_LEVEL ? `${profile.YEAR_LEVEL}${profile.YEAR_LEVEL === 1 ? 'st' : profile.YEAR_LEVEL === 2 ? 'nd' : profile.YEAR_LEVEL === 3 ? 'rd' : 'th'} Year` : 'Not provided',
      age: formatAge(profile?.BIRTH_DATE || null),
      status,
      lastAssessment: formatDate(session?.STARTED_AT || null),
      score,
      trend: status === 'High Risk' ? 'Increasing' : status === 'Moderate Risk' ? 'Stable' : 'Decreasing',
    };
  });
}
