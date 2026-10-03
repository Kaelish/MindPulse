import { supabase } from '../supabase/client';
import { AdminResultRow, bandForScore, fetchAdminResults, fetchAllRows } from './admin';
import { fetchAtRiskStudents, levelForScore } from './adminRecords';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export type ReportKey = 'stress-overview' | 'assessment-summary' | 'at-risk' | 'doctor-performance' | 'monthly-trends';

export interface ReportOptions {
  /** Local calendar days, YYYY-MM-DD. Empty string = no bound. */
  from: string;
  to: string;
  filter: string;
}

export interface GeneratedReport {
  filename: string;
  rowCount: number;
}

export interface ReportFilterOption {
  value: string;
  label: string;
}

export interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  icon: string;
  filterLabel: string;
  filterOptions: ReportFilterOption[];
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: 'stress-overview',
    title: 'Student Stress Overview',
    description: 'Comprehensive stress level analytics per student',
    icon: '◉',
    filterLabel: 'Stress Level',
    filterOptions: [
      { value: 'all', label: 'All levels' },
      { value: 'low', label: 'Low' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    key: 'assessment-summary',
    title: 'Assessment Results Summary',
    description: 'Summary of all assessment outcomes',
    icon: '▤',
    filterLabel: 'Stress Level',
    filterOptions: [
      { value: 'all', label: 'All levels' },
      { value: 'low', label: 'Low' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    key: 'at-risk',
    title: 'At-Risk Students Report',
    description: 'List of students requiring intervention',
    icon: '⚑',
    filterLabel: 'Risk Tier',
    filterOptions: [
      { value: 'all', label: 'All at-risk students' },
      { value: 'critical', label: 'Critical only' },
      { value: 'high', label: 'High only' },
    ],
  },
  {
    key: 'doctor-performance',
    title: 'Doctor Performance Report',
    description: 'Doctor consultation and case metrics',
    icon: '▣',
    filterLabel: 'Doctors',
    filterOptions: [
      { value: 'all', label: 'All doctors' },
      { value: 'verified', label: 'Verified only' },
      { value: 'pending', label: 'Pending approval' },
    ],
  },
  {
    key: 'monthly-trends',
    title: 'Monthly Trends Report',
    description: 'Month-over-month stress trends',
    icon: '◌',
    filterLabel: 'Sessions',
    filterOptions: [
      { value: 'all', label: 'All sessions' },
      { value: 'scored', label: 'Scored sessions only' },
    ],
  },
];

const pad = (value: number) => String(value).padStart(2, '0');

const dayKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const inRange = (iso: string, { from, to }: ReportOptions) => {
  const day = dayKey(iso);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

const stamp = (iso: string) => {
  const date = new Date(iso);
  return `${dayKey(iso)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvOf = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const filenameFor = (key: ReportKey) => `mindpulse-${key}-${dayKey(new Date().toISOString())}.csv`;

// ---------------------------------------------------------------- report data

interface BuiltReport {
  headers: string[];
  rows: unknown[][];
}

const buildStressOverview = async (options: ReportOptions): Promise<BuiltReport> => {
  if (!supabase) throw notConfigured();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, student_no, program, year_level')
    .eq('role', 'student')
    .order('created_at', { ascending: false });
  if (profilesError) throw new Error(profilesError.message);

  const sessions = await fetchAllRows<{ user_id: string; score: number | null; stress_level: string | null; created_at: string }>(
    'stress_sessions',
    'user_id, score, stress_level, created_at',
  );

  const byStudent = new Map<string, { score: number | null; created_at: string }[]>();
  for (const row of sessions) {
    if (!inRange(row.created_at, options)) continue;
    const list = byStudent.get(row.user_id) ?? [];
    list.push(row);
    byStudent.set(row.user_id, list);
  }

  const rows = ((profiles ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    student_no: string | null;
    program: string | null;
    year_level: string | null;
  }[])
    .map((student) => {
      const history = byStudent.get(student.id) ?? [];
      const latest = history.find((row) => row.score != null) ?? null;
      const level = latest && latest.score != null ? levelForScore(latest.score) : null;
      return {
        name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email || 'Unknown student',
        studentNo: student.student_no || student.id.slice(0, 8).toUpperCase(),
        email: student.email || '',
        program: student.program || '',
        year: student.year_level || '',
        count: history.length,
        score: latest?.score ?? null,
        level,
        date: latest ? dayKey(latest.created_at) : '',
      };
    })
    .filter((row) => options.filter === 'all' || (row.level ? row.level.toLowerCase() : '') === options.filter)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return {
    headers: [
      'Student',
      'Student No',
      'Email',
      'Program',
      'Year',
      'Assessments in Range',
      'Latest Score',
      'Stress Level',
      'Latest Assessment',
    ],
    rows: rows.map((row) => [
      row.name,
      row.studentNo,
      row.email,
      row.program,
      row.year,
      row.count,
      row.score ?? '',
      row.level ?? 'No assessment in range',
      row.date,
    ]),
  };
};

const buildAssessmentSummary = async (options: ReportOptions): Promise<BuiltReport> => {
  const results = await fetchAdminResults();

  const filtered = results.filter((row: AdminResultRow) => {
    if (!inRange(row.createdAt, options)) return false;
    if (options.filter === 'all') return true;
    if (row.score == null) return false;
    return bandForScore(row.score) === options.filter;
  });

  return {
    headers: [
      'Date',
      'Student',
      'Score',
      'Stress Level',
      'Survey Score',
      'Heart Rate (bpm)',
      'Reaction Time (ms)',
      'Emotion',
      'Face Confidence (%)',
      'Session ID',
    ],
    rows: filtered.map((row) => [
      stamp(row.createdAt),
      row.studentName,
      row.score ?? '',
      row.stressLevel ?? '',
      row.surveyScore ?? '',
      row.heartRate ?? '',
      row.reactionTimeMs ?? '',
      row.emotion ?? '',
      row.faceConfidence ?? '',
      row.id,
    ]),
  };
};

const buildAtRisk = async (options: ReportOptions): Promise<BuiltReport> => {
  const students = await fetchAtRiskStudents();

  const filtered = students.filter((row) => {
    if (!row.lastAssessment || !inRange(row.lastAssessment, options)) return false;
    if (options.filter !== 'all' && row.riskTier !== options.filter) return false;
    return true;
  });

  return {
    headers: [
      'Student',
      'Student No',
      'Email',
      'Program',
      'Year',
      'Risk Level',
      'Risk Score',
      'Last Assessment',
      'Trend',
      'Assigned Doctor',
      'Care Status',
      'Assessments',
    ],
    rows: filtered.map((row) => [
      row.name,
      row.studentNo,
      row.email,
      row.program,
      row.year,
      row.riskLabel,
      row.score ?? '',
      row.lastAssessment ? dayKey(row.lastAssessment) : '',
      row.trend,
      row.assignedDoctor ?? 'Not assigned',
      row.careStatus,
      row.sessions,
    ]),
  };
};

const buildDoctorPerformance = async (options: ReportOptions): Promise<BuiltReport> => {
  if (!supabase) throw notConfigured();

  const { data: doctorProfiles, error: doctorProfilesError } = await supabase
    .from('doctor_profiles')
    .select('user_id, specialization, license_no, is_verified');
  if (doctorProfilesError) throw new Error(doctorProfilesError.message);
  const doctors = (doctorProfiles ?? []) as {
    user_id: string;
    specialization: string | null;
    license_no: string | null;
    is_verified: boolean;
  }[];

  const userIds = doctors.map((doctor) => doctor.user_id);
  const { data: users, error: usersError } = userIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name, email').in('id', userIds)
    : { data: [], error: null };
  if (usersError) throw new Error(usersError.message);
  const usersById = new Map(
    ((users ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map(
      (row) => [row.id, row],
    ),
  );

  const appointments = await fetchAllRows<{ doctor_id: string; patient_id: string; status: string; created_at: string }>(
    'appointments',
    'doctor_id, patient_id, status, created_at',
  );

  const perDoctor = new Map<string, { total: number; completed: number; patients: Set<string> }>();
  for (const row of appointments) {
    if (!inRange(row.created_at, options)) continue;
    const bucket = perDoctor.get(row.doctor_id) ?? { total: 0, completed: 0, patients: new Set<string>() };
    bucket.total += 1;
    if (row.status === 'completed') bucket.completed += 1;
    bucket.patients.add(row.patient_id);
    perDoctor.set(row.doctor_id, bucket);
  }

  const rows = doctors
    .filter((doctor) => {
      if (options.filter === 'verified') return doctor.is_verified;
      if (options.filter === 'pending') return !doctor.is_verified;
      return true;
    })
    .map((doctor) => {
      const user = usersById.get(doctor.user_id);
      const name = user
        ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown doctor'
        : 'Unknown doctor';
      const stats = perDoctor.get(doctor.user_id);
      return {
        name,
        email: user?.email || '',
        specialization: doctor.specialization || '',
        license: doctor.license_no || '',
        verified: doctor.is_verified ? 'Yes' : 'No',
        appointments: stats?.total ?? 0,
        completed: stats?.completed ?? 0,
        students: stats?.patients.size ?? 0,
      };
    })
    .sort((a, b) => b.appointments - a.appointments || a.name.localeCompare(b.name));

  return {
    headers: ['Doctor', 'Email', 'Specialization', 'License No', 'Verified', 'Appointments', 'Completed', 'Unique Students'],
    rows: rows.map((row) => [
      row.name,
      row.email,
      row.specialization,
      row.license,
      row.verified,
      row.appointments,
      row.completed,
      row.students,
    ]),
  };
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const buildMonthlyTrends = async (options: ReportOptions): Promise<BuiltReport> => {
  if (!supabase) throw notConfigured();

  const sessions = await fetchAllRows<{ user_id: string; score: number | null; created_at: string }>(
    'stress_sessions',
    'user_id, score, created_at',
  );

  interface Bucket {
    label: string;
    order: string;
    count: number;
    users: Set<string>;
    scored: number;
    scoreSum: number;
    low: number;
    moderate: number;
    high: number;
  }
  const buckets = new Map<string, Bucket>();

  for (const row of sessions) {
    if (!inRange(row.created_at, options)) continue;
    if (options.filter === 'scored' && row.score == null) continue;
    const date = new Date(row.created_at);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const bucket = buckets.get(key) ?? {
      label: `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`,
      order: key,
      count: 0,
      users: new Set<string>(),
      scored: 0,
      scoreSum: 0,
      low: 0,
      moderate: 0,
      high: 0,
    };
    bucket.count += 1;
    bucket.users.add(row.user_id);
    if (row.score != null) {
      bucket.scored += 1;
      bucket.scoreSum += row.score;
      const band = bandForScore(row.score);
      if (band === 'low') bucket.low += 1;
      else if (band === 'moderate') bucket.moderate += 1;
      else bucket.high += 1;
    }
    buckets.set(key, bucket);
  }

  const rows = Array.from(buckets.values()).sort((a, b) => a.order.localeCompare(b.order));

  return {
    headers: ['Month', 'Assessments', 'Unique Students', 'Average Score', 'Low', 'Moderate', 'High'],
    rows: rows.map((bucket) => [
      bucket.label,
      bucket.count,
      bucket.users.size,
      bucket.scored ? Math.round(bucket.scoreSum / bucket.scored) : '',
      bucket.low,
      bucket.moderate,
      bucket.high,
    ]),
  };
};

export const generateAdminReport = async (key: ReportKey, options: ReportOptions): Promise<GeneratedReport> => {
  let built: BuiltReport;
  switch (key) {
    case 'stress-overview':
      built = await buildStressOverview(options);
      break;
    case 'assessment-summary':
      built = await buildAssessmentSummary(options);
      break;
    case 'at-risk':
      built = await buildAtRisk(options);
      break;
    case 'doctor-performance':
      built = await buildDoctorPerformance(options);
      break;
    case 'monthly-trends':
      built = await buildMonthlyTrends(options);
      break;
    default:
      throw new Error('Unknown report type.');
  }

  if (!built.rows.length) throw new Error('No records match this date range and filter.');

  const filename = filenameFor(key);
  downloadCsv(filename, csvOf(built.headers, built.rows));
  return { filename, rowCount: built.rows.length };
};
