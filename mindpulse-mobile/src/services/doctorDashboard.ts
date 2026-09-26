import { supabase } from '../supabase/client';
import { requireUserId } from './session';

export type DoctorPatientStatus = 'Stable' | 'Watch' | 'Critical' | 'Unassessed';

export interface DoctorPatientRow {
  id: string;
  name: string;
  initials: string;
  score: number | null;
  status: DoctorPatientStatus;
}

export interface DoctorScheduleItem {
  id: string;
  timeLabel: string;
  dayLabel: string;
  patientName: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  rawStatus: 'scheduled' | 'awaiting_payment' | 'declined' | 'confirmed' | 'completed' | 'cancelled';
  startsAt: Date | null;
}

export interface DoctorDashboardStats {
  patients: number;
  appointments: number;
  upcoming: number;
  videoCalls: number;
  riskAlerts: number;
}

export interface DoctorDashboardData {
  doctorName: string;
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
  const doctorId = await requireUserId();

  const { data: selfProfile, error: selfError } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', doctorId)
    .maybeSingle();
  if (selfError) throw new Error(selfError.message);
  const rawName = `${selfProfile?.first_name || ''} ${selfProfile?.last_name || ''}`.trim();
  const doctorName = rawName ? (/^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`) : 'Doctor';

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

  if (patientIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
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
      if (latestScores.has(row.user_id)) continue;
      latestScores.set(row.user_id, row.score);
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
        rawStatus: row.status as DoctorScheduleItem['rawStatus'],
        startsAt: parsed,
      };
    })
    .filter((item) => item.rawStatus !== 'cancelled' && item.rawStatus !== 'declined')
    .sort((a, b) => {
      if (a.startsAt && b.startsAt) return a.startsAt.getTime() - b.startsAt.getTime();
      if (a.startsAt) return -1;
      if (b.startsAt) return 1;
      return 0;
    });

  const upcoming = appointmentRows.filter(
    (row) => row.status === 'scheduled' || row.status === 'confirmed' || row.status === 'awaiting_payment',
  );
  const riskAlerts = patients.filter((patient) => patient.status === 'Critical').length;

  return {
    doctorName,
    stats: {
      patients: patients.length,
      appointments: appointmentRows.length,
      upcoming: upcoming.length,
      videoCalls,
      riskAlerts,
    },
    patients,
    schedule,
  };
};
