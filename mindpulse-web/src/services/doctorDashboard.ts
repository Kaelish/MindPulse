import { supabase } from '../supabase/client';
import { requireUserId } from './session';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export type DoctorPatientStatus = 'Stable' | 'Watch' | 'Critical' | 'Unassessed';

export interface DoctorPatientRow {
  id: string;
  name: string;
  initials: string;
  studentNo: string;
  age: number | null;
  lastVisit: string | null;
  score: number | null;
  status: DoctorPatientStatus;
}

export interface DoctorScheduleItem {
  id: string;
  timeLabel: string;
  dayLabel: string;
  patientName: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  startsAt: Date | null;
}

export interface DoctorDashboardStats {
  patients: number;
  appointments: number;
  upcoming: number;
  videoCalls: number;
  riskAlerts: number;
  assessedWeek: number;
}

export interface DoctorDashboardData {
  stats: DoctorDashboardStats;
  patients: DoctorPatientRow[];
  schedule: DoctorScheduleItem[];
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  scheduled_for: string | null;
  status: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  student_no: string | null;
  birth_date: string | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** appointments.scheduled_for is stored as "Aug 31, 2026 at 3:30 PM". */
export const parseScheduledFor = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value.replace(' at ', ' '));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const initialsOf = (name: string, email: string) => {
  const source = name || email || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
};

const ageFrom = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  return Math.max(
    0,
    today.getFullYear() -
      birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0),
  );
};

const statusForScore = (score: number | null): DoctorPatientStatus => {
  if (score == null) return 'Unassessed';
  if (score > 60) return 'Critical';
  if (score > 30) return 'Watch';
  return 'Stable';
};

const dayLabelFor = (date: Date): string => {
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();
  if (isTomorrow) return 'Tomorrow';
  return `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
};

export const fetchDoctorDashboard = async (): Promise<DoctorDashboardData> => {
  if (!supabase) throw notConfigured();
  const doctorId = await requireUserId();

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, patient_id, scheduled_for, status, created_at')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const appointmentRows = (appointments ?? []) as AppointmentRow[];

  const { data: videoRows, error: videoError } = await supabase
    .from('video_sessions')
    .select('id, doctor_id, status');
  if (videoError) throw new Error(videoError.message);
  const videoCalls = ((videoRows ?? []) as { doctor_id: string }[]).filter(
    (row) => row.doctor_id === doctorId,
  ).length;

  const patientIds = Array.from(new Set(appointmentRows.map((row) => row.patient_id)));
  let profileRows: ProfileRow[] = [];
  const latestScores = new Map<string, number | null>();
  const lastVisitById = new Map<string, { label: string; at: number }>();

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const assessedThisWeek = new Set<string>();
  if (patientIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, student_no, birth_date')
      .in('id', patientIds);
    if (profilesError) throw new Error(profilesError.message);
    profileRows = (profiles ?? []) as ProfileRow[];

    const { data: sessions, error: sessionsError } = await supabase
      .from('stress_sessions')
      .select('user_id, score, created_at')
      .in('user_id', patientIds)
      .order('created_at', { ascending: false });
    if (sessionsError) throw new Error(sessionsError.message);
    for (const row of (sessions ?? []) as { user_id: string; score: number | null; created_at: string }[]) {
      if (!latestScores.has(row.user_id)) latestScores.set(row.user_id, row.score);
      const at = new Date(row.created_at).getTime();
      if (!Number.isNaN(at) && at >= weekAgo) assessedThisWeek.add(row.user_id);
    }
  }

  for (const row of appointmentRows) {
    const parsed = parseScheduledFor(row.scheduled_for);
    const at = parsed ? parsed.getTime() : new Date(row.created_at).getTime();
    if (Number.isNaN(at) || row.status === 'cancelled') continue;
    const current = lastVisitById.get(row.patient_id);
    if (!current || at > current.at) {
      lastVisitById.set(row.patient_id, {
        label: parsed
          ? `${dayLabelFor(parsed)}, ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'Date not set',
        at,
      });
    }
  }

  const patients: DoctorPatientRow[] = profileRows.map((profile) => {
    const name =
      `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown student';
    const score = latestScores.has(profile.id) ? latestScores.get(profile.id) ?? null : null;
    return {
      id: profile.id,
      name,
      initials: initialsOf(name, profile.email || ''),
      studentNo: profile.student_no || profile.id.slice(0, 8).toUpperCase(),
      age: ageFrom(profile.birth_date),
      lastVisit: lastVisitById.get(profile.id)?.label ?? null,
      score,
      status: statusForScore(score),
    };
  });

  const schedule: DoctorScheduleItem[] = appointmentRows
    .map((row): DoctorScheduleItem => {
      const parsed = parseScheduledFor(row.scheduled_for);
      const profile = profileRows.find((candidate) => candidate.id === row.patient_id);
      const profileName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown student'
        : 'Unknown student';
      return {
        id: row.id,
        timeLabel: parsed
          ? parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : row.scheduled_for || 'Time not set',
        dayLabel: parsed ? dayLabelFor(parsed) : 'Unscheduled',
        patientName: profileName,
        status: row.status === 'completed' ? 'Completed' : row.status === 'cancelled' ? 'Cancelled' : 'Scheduled',
        startsAt: parsed,
      };
    })
    .filter((item) => item.status !== 'Cancelled')
    .sort((a, b) => {
      if (a.startsAt && b.startsAt) return a.startsAt.getTime() - b.startsAt.getTime();
      if (a.startsAt) return -1;
      if (b.startsAt) return 1;
      return 0;
    });

  const upcoming = appointmentRows.filter((row) => row.status === 'scheduled' || row.status === 'confirmed');
  const riskAlerts = patients.filter((patient) => patient.status === 'Critical').length;

  return {
    stats: {
      patients: patients.length,
      appointments: appointmentRows.length,
      upcoming: upcoming.length,
      videoCalls,
      riskAlerts,
      assessedWeek: assessedThisWeek.size,
    },
    patients,
    schedule,
  };
};
