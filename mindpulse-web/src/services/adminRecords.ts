import { supabase } from '../supabase/client';
import { bandForScore, fetchAllRows } from './admin';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export type RiskTier = 'critical' | 'high';
export type CareStatus = 'In Treatment' | 'Contacted' | 'Pending';
export type TrendLabel = 'Increasing' | 'Decreasing' | 'Stable' | 'New' | 'No assessment';

/** At-risk list splits the High stress band (>60) into Critical/High tiers. */
export const riskTierForScore = (score: number): RiskTier => (score > 80 ? 'critical' : 'high');

export const riskLabelForTier = (tier: RiskTier) => (tier === 'critical' ? 'Critical Risk' : 'High Risk');

export const levelForScore = (score: number): 'Low' | 'Moderate' | 'High' => {
  const band = bandForScore(score);
  return band === 'low' ? 'Low' : band === 'moderate' ? 'Moderate' : 'High';
};

interface StudentProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  student_no: string | null;
  program: string | null;
  year_level: string | null;
  created_at: string;
}

interface SessionLite {
  user_id: string;
  score: number | null;
  created_at: string;
}

interface AppointmentLite {
  patient_id: string;
  doctor_id: string;
  status: string;
  created_at: string;
}

interface Bundles {
  students: StudentProfileRow[];
  sessionsByUser: Map<string, SessionLite[]>;
  appointmentsByPatient: Map<string, AppointmentLite[]>;
  doctorNames: Map<string, string>;
}

const nameOf = (firstName: string | null, lastName: string | null, email: string | null) =>
  `${firstName || ''} ${lastName || ''}`.trim() || email || 'Unknown patient';

const initialsOf = (name: string, email: string) => {
  const source = name || email || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
};

/** Groups rows (already sorted newest-first) by user, preserving order. */
const groupNewestFirst = <T extends { created_at: string; key: string }>(rows: T[]): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.key) ?? [];
    list.push(row);
    grouped.set(row.key, list);
  }
  return grouped;
};

const trendFor = (sessions: SessionLite[]): TrendLabel => {
  const usable = sessions.filter((session) => session.score != null);
  if (usable.length === 0) return 'No assessment';
  if (usable.length === 1) return 'New';
  const delta = (usable[0].score ?? 0) - (usable[1].score ?? 0);
  return delta > 2 ? 'Increasing' : delta < -2 ? 'Decreasing' : 'Stable';
};

const ACTIVE_APPOINTMENT_STATUSES = new Set(['scheduled', 'confirmed', 'awaiting_payment']);

const careStatusFor = (appointments: AppointmentLite[]): CareStatus => {
  if (appointments.some((appointment) => ACTIVE_APPOINTMENT_STATUSES.has(appointment.status))) return 'In Treatment';
  if (appointments.some((appointment) => appointment.status === 'completed')) return 'Contacted';
  return 'Pending';
};

const pullBundles = async (): Promise<Bundles> => {
  if (!supabase) throw notConfigured();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, student_no, program, year_level, created_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false });
  if (profilesError) throw new Error(profilesError.message);
  const students = (profiles ?? []) as StudentProfileRow[];

  const sessions = await fetchAllRows<{ user_id: string; score: number | null; created_at: string }>(
    'stress_sessions',
    'user_id, score, created_at',
  );

  const appointments = await fetchAllRows<{
    patient_id: string;
    doctor_id: string;
    status: string;
    created_at: string;
  }>('appointments', 'patient_id, doctor_id, status, created_at');

  const { data: doctorProfiles, error: doctorProfilesError } = await supabase.from('doctor_profiles').select('user_id');
  if (doctorProfilesError) throw new Error(doctorProfilesError.message);
  const doctorIds = Array.from(new Set(((doctorProfiles ?? []) as { user_id: string }[]).map((row) => row.user_id)));

  const doctorNames = new Map<string, string>();
  if (doctorIds.length) {
    const { data: doctorUsers, error: doctorUsersError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', doctorIds);
    if (doctorUsersError) throw new Error(doctorUsersError.message);
    for (const row of (doctorUsers ?? []) as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }[]) {
      doctorNames.set(row.id, nameOf(row.first_name, row.last_name, row.email));
    }
  }

  return {
    students,
    sessionsByUser: groupNewestFirst(
      (sessions as SessionLite[]).map((row) => ({ ...row, key: row.user_id })),
    ),
    appointmentsByPatient: groupNewestFirst(
      (appointments as AppointmentLite[]).map((row) => ({ ...row, key: row.patient_id })),
    ),
    doctorNames,
  };
};

export interface StudentRecordRow {
  userId: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  studentNo: string;
  program: string;
  year: string;
  createdAt: string;
  sessions: number;
  lastAssessment: string | null;
  score: number | null;
  level: 'Low' | 'Moderate' | 'High' | null;
  trend: TrendLabel;
  assignedDoctor: string | null;
}

const buildRecord = (student: StudentProfileRow, bundles: Bundles): StudentRecordRow => {
  const sessions = bundles.sessionsByUser.get(student.id) ?? [];
  const latest = sessions.find((session) => session.score != null) ?? sessions[0] ?? null;
  const appointments = bundles.appointmentsByPatient.get(student.id) ?? [];
  const name = nameOf(student.first_name, student.last_name, student.email);

  return {
    userId: student.id,
    name,
    initials: initialsOf(name, student.email || ''),
    email: student.email || 'No email',
    phone: student.phone || null,
    studentNo: student.student_no || student.id.slice(0, 8).toUpperCase(),
    program: student.program || 'â€”',
    year: student.year_level || 'â€”',
    createdAt: student.created_at,
    sessions: sessions.length,
    lastAssessment: latest?.created_at ?? null,
    score: latest?.score ?? null,
    level: latest && latest.score != null ? levelForScore(latest.score) : null,
    trend: trendFor(sessions),
    assignedDoctor: appointments.length ? bundles.doctorNames.get(appointments[0].doctor_id) ?? null : null,
  };
};

export interface AtRiskRecordRow extends StudentRecordRow {
  riskTier: RiskTier;
  riskLabel: string;
  careStatus: CareStatus;
  phone: string | null;
}

interface RecordBundles {
  students: StudentRecordRow[];
  atRisk: AtRiskRecordRow[];
}

const buildBundles = (bundles: Bundles): RecordBundles => {
  const students = bundles.students.map((student) => buildRecord(student, bundles));

  const atRisk = students
    .map((record) => ({ record, appointments: bundles.appointmentsByPatient.get(record.userId) ?? [] }))
    // At-risk = most recent scored assessment in the High band (>60).
    .filter(({ record }) => record.score != null && (record.score ?? 0) > 60)
    .map(({ record, appointments }) => {
      const riskTier = riskTierForScore(record.score ?? 0);
      return {
        ...record,
        riskTier,
        riskLabel: riskLabelForTier(riskTier),
        careStatus: careStatusFor(appointments),
        // phone now rides along from StudentRecordRow (profiles.phone), so the
        // Call action in the at-risk table points at a real number.
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return { students, atRisk };
};

/** Single round-trip used by the Records view (both lists share one pull). */
export const fetchRecordBundles = async (): Promise<RecordBundles> => buildBundles(await pullBundles());

export const fetchStudentRecords = async (): Promise<StudentRecordRow[]> =>
  (await fetchRecordBundles()).students;

/** Students whose most recent scored assessment sits in the High band (>60). */
export const fetchAtRiskStudents = async (): Promise<AtRiskRecordRow[]> =>
  (await fetchRecordBundles()).atRisk;

export interface RecordSessionRow {
  id: string;
  createdAt: string;
  score: number | null;
  stressLevel: string | null;
  heartRate: number | null;
  surveyScore: number | null;
  reactionTimeMs: number | null;
  emotion: string | null;
  /** Tool title from survey_answers.jsonb (null on pre-answers sessions). */
  toolTitle: string | null;
}

export const fetchStudentRecordSessions = async (userId: string): Promise<RecordSessionRow[]> => {
  if (!supabase) throw notConfigured();

  const { data, error } = await supabase
    .from('stress_sessions')
    .select('id, created_at, score, stress_level, heart_rate, survey_score, reaction_time_ms, emotion, survey_answers')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
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
    survey_answers: { toolTitle?: unknown } | null;
  }[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    score: row.score,
    stressLevel: row.stress_level,
    heartRate: row.heart_rate,
    surveyScore: row.survey_score,
    reactionTimeMs: row.reaction_time_ms,
    emotion: row.emotion,
    toolTitle: typeof row.survey_answers?.toolTitle === 'string' ? row.survey_answers.toolTitle : null,
  }));
};

export interface ConsultationRecordRow {
  appointmentId: string;
  studentId: string;
  doctorId: string;
  studentName: string;
  studentEmail: string;
  doctorName: string;
  scheduledFor: string;
  followUp: string | null;
  updatedAt: string | null;
  patientNoteWritten: boolean;
}

const personLabel = (entry: { name: string; email: string } | undefined): string =>
  entry?.name || entry?.email || 'Unknown';

export const fetchConsultationRecords = async (): Promise<ConsultationRecordRow[]> => {
  if (!supabase) throw notConfigured();

  const { data, error } = await supabase
    .from('consultation_notes')
    .select(
      'appointment_id, patient_id, doctor_id, follow_up, created_at, updated_at, appointments(scheduled_for)',
    )
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  // A consultation only reaches the notes table once the doctor writes the
  // after-visit summary, so pull the booked/completed appointments in too —
  // otherwise recent consultations are missing from the admin's records.
  const { data: appointmentRows, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_id, scheduled_for, status, created_at')
    .in('status', ['scheduled', 'awaiting_payment', 'confirmed', 'completed'])
    .order('created_at', { ascending: false })
    .limit(200);
  if (appointmentError) throw new Error(appointmentError.message);

  type RawNote = {
    appointment_id: string;
    patient_id: string;
    doctor_id: string;
    follow_up: string | null;
    created_at: string | null;
    updated_at: string | null;
    appointments: { scheduled_for?: string } | { scheduled_for?: string }[] | null;
  };

  type RawAppointment = {
    id: string;
    patient_id: string;
    doctor_id: string;
    scheduled_for: string | null;
    status: string;
    created_at: string | null;
  };

  const rows = (data ?? []) as unknown as RawNote[];
  const appointments = (appointmentRows ?? []) as unknown as RawAppointment[];
  const ids = Array.from(
    new Set(
      [...rows.flatMap((row) => [row.patient_id, row.doctor_id]), ...appointments.flatMap((row) => [row.patient_id, row.doctor_id])].filter(
        (id): id is string => !!id,
      ),
    ),
  );

  const people = new Map<string, { name: string; email: string }>();
  if (ids.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, email')
      .in('id', ids);
    if (!profileError) {
      for (const profile of (profiles ?? []) as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        email: string | null;
      }[]) {
        const name =
          (profile.full_name ?? '').trim() ||
          [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
        people.set(profile.id, { name, email: profile.email ?? '' });
      }
    }
  }

  const noteByAppointment = new Map(rows.map((row) => [row.appointment_id, row]));

  const records: (ConsultationRecordRow & { sortAt: string })[] = rows.map((row) => {
    const appointment = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
    return {
      appointmentId: row.appointment_id,
      studentId: row.patient_id,
      doctorId: row.doctor_id,
      studentName: personLabel(people.get(row.patient_id)),
      studentEmail: people.get(row.patient_id)?.email ?? '',
      doctorName: personLabel(people.get(row.doctor_id)),
      scheduledFor: appointment?.scheduled_for ?? '',
      followUp: row.follow_up ?? null,
      updatedAt: row.updated_at,
      patientNoteWritten: true,
      sortAt: row.updated_at ?? row.created_at ?? '',
    };
  });

  // Consultations whose note was never written still belong in the records;
  // they render with patientNoteWritten false and "—" in Last Updated.
  for (const appointment of appointments) {
    if (noteByAppointment.has(appointment.id)) continue;
    records.push({
      appointmentId: appointment.id,
      studentId: appointment.patient_id,
      doctorId: appointment.doctor_id,
      studentName: personLabel(people.get(appointment.patient_id)),
      studentEmail: people.get(appointment.patient_id)?.email ?? '',
      doctorName: personLabel(people.get(appointment.doctor_id)),
      scheduledFor: appointment.scheduled_for ?? '',
      followUp: null,
      updatedAt: null,
      patientNoteWritten: false,
      sortAt: appointment.created_at ?? '',
    });
  }

  records.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  return records.map(({ sortAt: _sortAt, ...row }) => row);
};
