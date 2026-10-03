import { supabase } from '../supabase/client';
import type { AppRole, StressLevel } from '../types/supabase';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

// Bands match the patient app's levelForScore (mobile dashboard.ts) and the
// doctor portal's riskForScore: Low 0-35, Moderate 36-60, High 61-100.
export const bandForScore = (score: number): 'low' | 'moderate' | 'high' =>
  score > 60 ? 'high' : score > 35 ? 'moderate' : 'low';

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

/** Newest session per user — order-independent: keeps the row with the newest `created_at`. */
const latestSessionsByUser = <T extends { user_id: string; created_at: string }>(rows: T[]): Map<string, T> => {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.user_id);
    if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) {
      latest.set(row.user_id, row);
    }
  }
  return latest;
};

/**
 * Fetches every row of a table — PostgREST caps a single response at 1000
 * rows, so large tables are paged with `.range()` (newest first, `id` as a
 * stable tiebreaker so pages never overlap or skip).
 */
const PAGE_SIZE = 1000;

export const fetchAllRows = async <T>(
  table: 'stress_sessions' | 'appointments' | 'profiles',
  columns: string,
  filter?: { column: string; values: string[] },
): Promise<T[]> => {
  if (!supabase) throw notConfigured();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns);
    if (filter) query = query.in(filter.column, filter.values);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
};

export const fetchAdminOverview = async (): Promise<AdminOverviewStats> => {
  if (!supabase) throw notConfigured();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role');
  if (profilesError) throw new Error(profilesError.message);
  const profileRows = (profiles ?? []) as ProfileRow[];

  const sessionRows = await fetchAllRows<SessionRow>('stress_sessions', 'user_id, score, created_at');

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

export interface AppointmentStatusCount {
  status: string;
  label: string;
  count: number;
}

export interface AdminActivityWeek {
  label: string;
  bookings: number;
  assessments: number;
}

export interface AdminDashboardCharts {
  statuses: AppointmentStatusCount[];
  weeks: AdminActivityWeek[];
  /** What each entry in `weeks` covers: a trailing week or a calendar month. */
  granularity?: 'week' | 'month';
  /** Range shown in the chart caption, e.g. "last 12 weeks". */
  rangeLabel?: string;
}

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Awaiting approval',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const APPOINTMENT_STATUS_ORDER = [
  'awaiting_payment',
  'scheduled',
  'confirmed',
  'completed',
  'declined',
  'cancelled',
];

const startOfUtcWeek = (value: Date | string) => {
  const d = new Date(value);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
};

export const fetchAdminDashboardCharts = async (): Promise<AdminDashboardCharts> => {
  if (!supabase) throw notConfigured();

  const [appointmentRows, sessionRows] = await Promise.all([
    fetchAllRows<{ created_at: string; status: string | null }>('appointments', 'created_at, status'),
    fetchAllRows<{ created_at: string }>('stress_sessions', 'created_at'),
  ]);

  const counts = new Map<string, number>();
  appointmentRows.forEach((row) => {
    const status = row.status ?? 'scheduled';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  const statuses: AppointmentStatusCount[] = APPOINTMENT_STATUS_ORDER.map((status) => ({
    status,
    label: APPOINTMENT_STATUS_LABELS[status] ?? status,
    count: counts.get(status) ?? 0,
  }));

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const parseTime = (value: string) => {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  };

  // Both tables are fetched in full above, so bucket the entire history from
  // the earliest activity onward — the old fixed 12-week window silently
  // dropped every older assessment.
  const times: number[] = [];
  appointmentRows.forEach((row) => {
    const time = parseTime(row.created_at);
    if (time != null) times.push(time);
  });
  sessionRows.forEach((row) => {
    const time = parseTime(row.created_at);
    if (time != null) times.push(time);
  });

  const currentWeek = startOfUtcWeek(now);
  const earliest = times.length ? Math.min(...times) : currentWeek.getTime();
  const spanWeeks = Math.floor((currentWeek.getTime() - earliest) / weekMs);

  const weeks: AdminActivityWeek[] = [];
  const tally = (
    rows: { created_at: string }[],
    indexOf: (time: number) => number,
    key: 'bookings' | 'assessments',
  ) => {
    rows.forEach((row) => {
      const time = parseTime(row.created_at);
      if (time == null) return;
      const index = indexOf(time);
      if (index >= 0 && index < weeks.length) weeks[index][key] += 1;
    });
  };

  if (spanWeeks <= 26) {
    // Weekly buckets stretched back to the first week with activity, keeping
    // the familiar trailing 12 weeks when history is short or empty.
    const back = Math.max(11, spanWeeks);
    const firstMonday = new Date(currentWeek.getTime() - back * weekMs);
    for (let index = 0; index <= back; index += 1) {
      const start = new Date(firstMonday.getTime() + index * weekMs);
      weeks.push({
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        bookings: 0,
        assessments: 0,
      });
    }
    const weeklyIndex = (time: number) =>
      Math.floor((startOfUtcWeek(new Date(time)).getTime() - firstMonday.getTime()) / weekMs);
    tally(appointmentRows, weeklyIndex, 'bookings');
    tally(sessionRows, weeklyIndex, 'assessments');
    return { statuses, weeks, granularity: 'week', rangeLabel: `last ${weeks.length} weeks` };
  }

  // Longer history switches to calendar months (the same bucket labels
  // Analytics uses) so the whole range stays readable on one line chart.
  const start = new Date(earliest);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const spanMonths = (now.getFullYear() - startYear) * 12 + (now.getMonth() - startMonth) + 1;
  const visibleMonths = Math.min(spanMonths, 240);
  const skippedMonths = spanMonths - visibleMonths;
  for (let offset = skippedMonths; offset < spanMonths; offset += 1) {
    const date = new Date(startYear, startMonth + offset, 1);
    weeks.push({ label: bucketLabel(date.getFullYear(), date.getMonth()), bookings: 0, assessments: 0 });
  }
  const monthlyIndex = (time: number) => {
    const date = new Date(time);
    return (date.getFullYear() - startYear) * 12 + (date.getMonth() - startMonth) - skippedMonths;
  };
  tally(appointmentRows, monthlyIndex, 'bookings');
  tally(sessionRows, monthlyIndex, 'assessments');
  return { statuses, weeks, granularity: 'month', rangeLabel: `last ${visibleMonths} months` };
};

export interface AdminAccountRow {
  id: string;
  role: 'student' | 'doctor';
  name: string;
  initials: string;
  /** Profile photo (profile-photos bucket); null when the user has none. */
  avatarUrl: string | null;
  email: string;
  /** Mobile number captured at registration (profiles.phone). */
  phone: string | null;
  program: string;
  year: string;
  studentNo: string | null;
  patients: number;
  isVerified: boolean;
  onboardingComplete: boolean;
  createdAt: string;
  latestScore: number | null;
  latestLevel: StressLevel | null;
  licenseNo: string | null;
  contactNumber: string | null;
  bio: string | null;
}

interface AccountProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  program: string | null;
  year_level: string | null;
  student_no: string | null;
  avatar_url: string | null;
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
    .select('id, first_name, last_name, email, phone, program, year_level, student_no, avatar_url, onboarding_complete, created_at')
    .eq('role', role)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (profiles ?? []) as AccountProfileRow[];
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);

  const sessionRows = await fetchAllRows<{ user_id: string; score: number | null; stress_level: string | null; created_at: string }>(
    'stress_sessions',
    'user_id, score, stress_level, created_at',
    { column: 'user_id', values: ids },
  );
  const latest = latestSessionsByUser(sessionRows);

  const sessionCounts = new Map<string, number>();
  for (const row of sessionRows as SessionRow[]) {
    sessionCounts.set(row.user_id, (sessionCounts.get(row.user_id) ?? 0) + 1);
  }

  const appointmentCounts = new Map<string, number>();
  if (role === 'doctor') {
    const appointmentRows = await fetchAllRows<{ doctor_id: string }>(
      'appointments',
      'doctor_id',
      { column: 'doctor_id', values: ids },
    );
    for (const row of appointmentRows) {
      appointmentCounts.set(row.doctor_id, (appointmentCounts.get(row.doctor_id) ?? 0) + 1);
    }
  }

  let verifiedByUser = new Map<string, boolean>();
  let professionalByUser = new Map<string, { specialization: string | null; license_no: string | null; contact_number: string | null; bio: string | null }>();
  if (role === 'doctor') {
    const { data: doctorProfiles, error: doctorProfilesError } = await supabase
      .from('doctor_profiles')
      .select('user_id, is_verified, specialization, license_no, contact_number, bio')
      .in('user_id', ids);
    if (doctorProfilesError) throw new Error(doctorProfilesError.message);
    const doctorRows = (doctorProfiles ?? []) as {
      user_id: string;
      is_verified: boolean;
      specialization: string | null;
      license_no: string | null;
      contact_number: string | null;
      bio: string | null;
    }[];
    verifiedByUser = new Map(doctorRows.map((row) => [row.user_id, row.is_verified]));
    professionalByUser = new Map(
      doctorRows.map((row) => [
        row.user_id,
        { specialization: row.specialization, license_no: row.license_no, contact_number: row.contact_number, bio: row.bio },
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
      role,
      name,
      initials: initialsOf(name, row.email || ''),
      avatarUrl: row.avatar_url ?? null,
      email: row.email || 'No email',
      phone: row.phone || null,
      program: role === 'doctor' ? professional?.specialization || '—' : row.program || '—',
      year: row.year_level || '—',
      studentNo: row.student_no || null,
      patients: role === 'doctor' ? appointmentCounts.get(row.id) ?? 0 : sessionCounts.get(row.id) ?? 0,
      isVerified: verifiedByUser.get(row.id) ?? false,
      onboardingComplete: row.onboarding_complete,
      createdAt: row.created_at,
      latestScore: latestSession?.score ?? null,
      latestLevel: (latestSession?.stress_level as StressLevel | null) ?? null,
      licenseNo: professional?.license_no ?? null,
      contactNumber: professional?.contact_number ?? null,
      bio: professional?.bio ?? null,
    };
  });
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
  /** Tool title stored in survey_answers.jsonb; null on sessions saved before per-item answers existed. */
  toolTitle: string | null;
}

/**
 * Display name of the assessment that produced a session. Sessions predating
 * stored answers are all built-in multi-modal PSS-10 check-ins (that flow was
 * the only one that saved without answers), so they fall back accordingly.
 * Accepts any row shape carrying the parsed tool title.
 */
export const assessmentNameOf = (row: { toolTitle: string | null }): string =>
  row.toolTitle ?? 'PSS-10 (multi-modal)';

export const fetchAdminResults = async (): Promise<AdminResultRow[]> => {
  if (!supabase) throw notConfigured();

  const rows = await fetchAllRows<{
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
    survey_answers: { toolTitle?: unknown } | null;
  }>(
    'stress_sessions',
    'id, user_id, score, stress_level, heart_rate, survey_score, reaction_time_ms, emotion, face_confidence, created_at, survey_answers',
  );
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
      toolTitle: typeof row.survey_answers?.toolTitle === 'string' ? row.survey_answers.toolTitle : null,
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

/** Short month label ("Jan '26") shared by Analytics and the dashboard chart. */
const bucketLabel = (year: number, month: number) => `${MONTH_LABELS[month]} '${String(year).slice(-2)}`;

/**
 * `months = 0` → All Time (default). Any other value filters **every** metric
 * (totals, average, bands, assessed students, engagement) to those calendar
 * months ending this month, so the page stays consistent with the dashboard
 * when left on All Time.
 */
export const fetchAdminAnalytics = async (months = 0): Promise<AdminAnalytics> => {
  if (!supabase) throw notConfigured();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role');
  if (profilesError) throw new Error(profilesError.message);
  const profileRows = (profiles ?? []) as ProfileRow[];

  const sessionRows = await fetchAllRows<SessionRow>('stress_sessions', 'user_id, score, created_at');

  const now = new Date();
  const periodStart = months > 0 ? new Date(now.getFullYear(), now.getMonth() - (months - 1), 1) : null;
  const inPeriod = periodStart
    ? sessionRows.filter((row) => new Date(row.created_at).getTime() >= periodStart.getTime())
    : sessionRows;

  const students = profileRows.filter((row) => row.role === 'student').length;

  // Same definition as the dashboard's "assessed" counter: one student counts
  // once, from their newest session in the selected period, and only when it
  // carries a score.
  const latest = latestSessionsByUser(inPeriod);
  let low = 0;
  let moderate = 0;
  let high = 0;
  let assessed = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  Array.from(latest.values()).forEach((session) => {
    if (session.score == null) return;
    assessed += 1;
    const band = bandForScore(session.score);
    if (band === 'low') low += 1;
    else if (band === 'moderate') moderate += 1;
    else high += 1;
  });
  for (const session of inPeriod) {
    if (session.score == null) continue;
    scoreSum += session.score;
    scoreCount += 1;
  }

  const buckets: { year: number; month: number; label: string }[] = [];
  if (months > 0) {
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({ year: date.getFullYear(), month: date.getMonth(), label: bucketLabel(date.getFullYear(), date.getMonth()) });
    }
  } else {
    // All Time: every calendar month from the first session up to this month.
    let earliestYear = now.getFullYear();
    let earliestMonth = now.getMonth();
    for (const row of sessionRows) {
      const created = new Date(row.created_at);
      if (Number.isNaN(created.getTime())) continue;
      if (
        created.getFullYear() < earliestYear ||
        (created.getFullYear() === earliestYear && created.getMonth() < earliestMonth)
      ) {
        earliestYear = created.getFullYear();
        earliestMonth = created.getMonth();
      }
    }
    const cursor = new Date(earliestYear, earliestMonth, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    let guard = 0;
    while (cursor <= end && guard < 240) {
      buckets.push({ year: cursor.getFullYear(), month: cursor.getMonth(), label: bucketLabel(cursor.getFullYear(), cursor.getMonth()) });
      cursor.setMonth(cursor.getMonth() + 1);
      guard += 1;
    }
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
    totalSessions: inPeriod.length,
    avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    low,
    moderate,
    high,
    students,
    assessedStudents: assessed,
    engagementPct: students ? Math.round((assessed / students) * 100) : 0,
    monthly,
  };
};
