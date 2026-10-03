import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { fetchAvatarUrls } from './avatars';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type DashboardTone = 'positive' | 'warning' | 'danger' | 'neutral';
export type DashboardRisk = 'High Risk' | 'Moderate Risk' | 'Low Risk' | 'No Assessment';
export type DashboardConsultStatus = 'scheduled' | 'confirmed' | 'awaiting_payment';

export interface DashboardNote {
  text: string;
  tone: DashboardTone;
}

export interface DashboardMetric {
  value: number;
  note: DashboardNote;
}

export interface DashboardRecentCase {
  id: string;
  userId: string;
  name: string;
  initials: string;
  /** Student's profile photo; null when unset (or migration 0017 not applied). */
  avatarUrl: string | null;
  studentNo: string;
  stress: number | null;
  risk: DashboardRisk;
  activityLabel: string;
}

export interface DashboardConsultation {
  id: string;
  patientName: string;
  initials: string;
  avatarUrl: string | null;
  status: DashboardConsultStatus;
  statusLabel: string;
  whenLabel: string;
  typeLabel: string;
  startsAt: number | null;
}

export interface DoctorDashboardOverview {
  activeCases: DashboardMetric;
  pendingReviews: DashboardMetric;
  highRiskStudents: DashboardMetric;
  completedThisWeek: DashboardMetric;
  recentCases: DashboardRecentCase[];
  upcoming: DashboardConsultation[];
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  student_no: string | null;
  created_at: string;
}

interface SessionRow {
  user_id: string;
  score: number | null;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  scheduled_for: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** appointments.scheduled_for is stored as "Aug 31, 2026 at 3:30 PM". */
export const parseScheduledFor = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value.replace(' at ', ' '));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const initialsOf = (name: string, email: string): string => {
  const source = name || email || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const displayName = (row: { first_name: string | null; last_name: string | null; email: string | null }): string =>
  `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || 'Unknown student';

/** Same bands as StudentCasesView so the portal never disagrees with itself. */
const riskForScore = (score: number | null): DashboardRisk => {
  if (score == null) return 'No Assessment';
  if (score > 60) return 'High Risk';
  if (score > 35) return 'Moderate Risk';
  return 'Low Risk';
};

export const timeAgoLabel = (iso: string | null | undefined): string => {
  if (!iso) return 'No activity yet';
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return 'No activity yet';
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today, 4:45 PM" / "Tomorrow, 9:00 AM" / "Sep 28, 4:45 PM" */
const whenLabelFor = (date: Date | null, fallback: string | null): string => {
  const time = date
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : fallback || 'Time not set';
  if (!date) return time;
  const now = new Date();
  if (sameDay(date, now)) return `Today, ${time}`;
  const tomorrow = new Date(now.getTime() + DAY_MS);
  if (sameDay(date, tomorrow)) return `Tomorrow, ${time}`;
  return `${DAY_LABELS[date.getDay()]}, ${MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${time}`;
};

/** Percentage movement against last week, with a plain-text fallback. */
const trendNote = (current: number, previous: number, emptyText: string): DashboardNote => {
  if (current <= 0) return { text: emptyText, tone: 'neutral' };
  if (previous > 0) {
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return { text: 'No change from last week', tone: 'neutral' };
    return {
      text: `${pct > 0 ? '+' : ''}${pct}% from last week`,
      tone: pct > 0 ? 'positive' : 'danger',
    };
  }
  return { text: `+${current} from last week`, tone: 'positive' };
};

const countSince = (rows: { created_at: string }[], from: number, to: number): number =>
  rows.filter((row) => {
    const at = new Date(row.created_at).getTime();
    return !Number.isNaN(at) && at >= from && at < to;
  }).length;

export const fetchDoctorDashboardOverview = async (): Promise<DoctorDashboardOverview> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();

  const [{ data: profileRows, error: profilesError }, { data: sessionRows, error: sessionsError }, { data: appointmentRows, error: appointmentsError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name, email, student_no, created_at')
        .eq('role', 'student')
        .order('created_at', { ascending: true }),
      supabase
        .from('stress_sessions')
        .select('user_id, score, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('appointments')
        .select('id, patient_id, scheduled_for, status, created_at, updated_at')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false }),
    ]);

  if (profilesError) throw new Error(profilesError.message);
  if (sessionsError) throw new Error(sessionsError.message);
  if (appointmentsError) throw new Error(appointmentsError.message);

  const profiles = (profileRows ?? []) as ProfileRow[];
  const sessions = (sessionRows ?? []) as SessionRow[];
  const appointments = (appointmentRows ?? []) as AppointmentRow[];

  const avatars = await fetchAvatarUrls([
    ...profiles.map((profile) => profile.id),
    ...appointments.map((row) => row.patient_id),
  ]);

  // Latest stress result + most recent session per student (sessions come newest first).
  const latestScore = new Map<string, number | null>();
  const latestAt = new Map<string, string>();
  const highRiskAlerts = new Set<string>();
  const now = Date.now();
  const weekAgo = now - WEEK_MS;
  const twoWeeksAgo = now - 2 * WEEK_MS;
  for (const row of sessions) {
    if (!latestScore.has(row.user_id)) {
      latestScore.set(row.user_id, row.score);
      latestAt.set(row.user_id, row.created_at);
    }
    const at = new Date(row.created_at).getTime();
    if (!Number.isNaN(at) && at >= weekAgo && row.score != null && row.score > 60) {
      highRiskAlerts.add(row.user_id);
    }
  }

  const cases: DashboardRecentCase[] = profiles.map((profile) => {
    const name = displayName(profile);
    const score = latestScore.has(profile.id) ? latestScore.get(profile.id) ?? null : null;
    return {
      id: profile.id,
      userId: profile.id,
      name,
      initials: initialsOf(name, profile.email || ''),
      avatarUrl: avatars.get(profile.id) ?? null,
      studentNo: profile.student_no || profile.id.slice(0, 8).toUpperCase(),
      stress: score,
      risk: riskForScore(score),
      activityLabel: timeAgoLabel(latestAt.get(profile.id)),
    };
  });

  cases.sort((a, b) => {
    if (a.stress == null && b.stress == null) return a.name.localeCompare(b.name);
    if (a.stress == null) return 1;
    if (b.stress == null) return -1;
    return b.stress - a.stress;
  });

  // Names for appointment patients who are not part of the student roster yet.
  const knownIds = new Set(profiles.map((profile) => profile.id));
  const missingIds = Array.from(
    new Set(appointments.map((row) => row.patient_id).filter((id) => id && !knownIds.has(id))),
  );
  let extraProfiles: ProfileRow[] = [];
  if (missingIds.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, student_no, created_at')
      .in('id', missingIds);
    if (!error) extraProfiles = (data ?? []) as ProfileRow[];
  }
  const nameById = new Map<string, ProfileRow>();
  for (const row of [...profiles, ...extraProfiles]) nameById.set(row.id, row);

  const patientNames = new Map<string, string>();
  const patientInitials = new Map<string, string>();
  for (const row of appointments) {
    if (patientNames.has(row.patient_id)) continue;
    const profile = nameById.get(row.patient_id);
    const name = profile ? displayName(profile) : 'Unknown student';
    patientNames.set(row.patient_id, name);
    patientInitials.set(row.patient_id, initialsOf(name, profile?.email || ''));
  }

  const completedByPatient = new Set(
    appointments.filter((row) => row.status === 'completed').map((row) => row.patient_id),
  );

  const statusLabel: Record<string, string> = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    awaiting_payment: 'Awaiting payment',
  };

  const upcoming = appointments
    .filter((row): row is AppointmentRow & { status: DashboardConsultStatus } =>
      row.status === 'scheduled' || row.status === 'confirmed' || row.status === 'awaiting_payment')
    .map((row) => {
      const parsed = parseScheduledFor(row.scheduled_for);
      return {
        id: row.id,
        patientName: patientNames.get(row.patient_id) || 'Unknown student',
        initials: patientInitials.get(row.patient_id) || '??',
        avatarUrl: avatars.get(row.patient_id) ?? null,
        status: row.status,
        statusLabel: statusLabel[row.status] ?? row.status,
        whenLabel: whenLabelFor(parsed, row.scheduled_for),
        typeLabel: completedByPatient.has(row.patient_id) ? 'Follow-up' : 'Initial Assessment',
        startsAt: parsed ? parsed.getTime() : null,
      } as DashboardConsultation;
    })
    .sort((a, b) => {
      if (a.startsAt == null && b.startsAt == null) return 0;
      if (a.startsAt == null) return 1;
      if (b.startsAt == null) return -1;
      return a.startsAt - b.startsAt;
    })
    .slice(0, 5);

  const pendingRows = appointments.filter((row) => row.status === 'scheduled');
  const completedWeek = appointments.filter((row) => {
    if (row.status !== 'completed') return false;
    const at = new Date(row.updated_at || row.created_at).getTime();
    return !Number.isNaN(at) && at >= weekAgo;
  });
  const completedPrevWeek = appointments.filter((row) => {
    if (row.status !== 'completed') return false;
    const at = new Date(row.updated_at || row.created_at).getTime();
    return !Number.isNaN(at) && at >= twoWeeksAgo && at < weekAgo;
  });

  const newCasesWeek = countSince(profiles, weekAgo, now);
  const newCasesPrevWeek = countSince(profiles, twoWeeksAgo, weekAgo);

  const highRiskCount = cases.filter((item) => item.risk === 'High Risk').length;

  return {
    activeCases: {
      value: cases.length,
      note: trendNote(newCasesWeek, newCasesPrevWeek, 'No new cases this week'),
    },
    pendingReviews: {
      value: pendingRows.length,
      note:
        pendingRows.length > 0
          ? { text: 'Requires attention', tone: 'warning' }
          : { text: 'All caught up', tone: 'positive' },
    },
    highRiskStudents: {
      value: highRiskCount,
      note:
        highRiskCount === 0
          ? { text: 'No students at high risk', tone: 'positive' }
          : highRiskAlerts.size > 0
            ? { text: `${highRiskAlerts.size} new alert${highRiskAlerts.size === 1 ? '' : 's'}`, tone: 'danger' }
            : { text: 'No new alerts', tone: 'neutral' },
    },
    completedThisWeek: {
      value: completedWeek.length,
      note: trendNote(completedWeek.length, completedPrevWeek.length, 'No sessions completed yet'),
    },
    recentCases: cases.slice(0, 5),
    upcoming,
  };
};
