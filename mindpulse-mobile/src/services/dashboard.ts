import { supabase } from '../supabase/client';
import { recordPlantSession } from './plantProgress';

export interface StressSessionItem {
  id: string;
  score: number;
  title: string;
  date: string;
  status: 'Low' | 'Moderate' | 'High';
  statusColor: 'green' | 'yellow' | 'pink';
  heartRate?: number;
  notes?: string;
  surveyScore?: number;
  emotion?: string;
  reactionTimeMs?: number;
  faceConfidencePercent?: number;
}

export interface DashboardMetrics {
  latestScore: number | null;
  latestLevel: 'Low' | 'Moderate' | 'High' | null;
  latestTrend: 'Increasing' | 'Decreasing' | 'Stable' | null;
  avgHeartRate: number | null;
  avgHeartRateStatus: string;
  avgStressScore: number | null;
  avgStressStatus: string;
  totalAssessments: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'alert' | 'info' | 'appointment';
}

export interface PatientDashboardData {
  userName: string;
  userEmail: string;
  userInitials: string;
  greetingDate: string;
  yearLevel: string | null;
  livingSituation: string | null;
  healthConditions: string[];
  metrics: DashboardMetrics;
  recentSessions: StressSessionItem[];
  notifications: NotificationItem[];
}

const levelForScore = (score: number): 'Low' | 'Moderate' | 'High' =>
  score > 60 ? 'High' : score > 35 ? 'Moderate' : 'Low';

const colorForScore = (score: number): 'green' | 'yellow' | 'pink' =>
  score > 60 ? 'pink' : score > 35 ? 'yellow' : 'green';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const formatGreetingDate = (): string => {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday}, ${now.getDate()} ${month}`;
};

const timeAgo = (iso: string): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
};

const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const fetchDashboardData = async (userId?: string): Promise<PatientDashboardData> => {
  let targetUserId = userId;
  let metadata: Record<string, any> | null = null;
  let authEmail = '';

  if (!targetUserId) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    targetUserId = user.id;
    metadata = user.user_metadata ?? null;
    authEmail = user.email || '';
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, email, year_level, living_situation, mental_conditions, physical_conditions')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  let userName =
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  if (!userName && (metadata?.first_name || metadata?.last_name)) {
    userName = `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim();
  }
  if (!userName) userName = 'Student';

  const userEmail = profile?.email || authEmail;
  const userInitials = initialsFor(userName);

  const conditions = [
    ...(Array.isArray(profile?.mental_conditions) ? profile.mental_conditions : []),
    ...(Array.isArray(profile?.physical_conditions) ? profile.physical_conditions : []),
  ].filter((c): c is string => typeof c === 'string' && c.trim().length > 0);

  const { data: statRows, error: statError } = await supabase
    .from('stress_sessions')
    .select('score, heart_rate')
    .order('created_at', { ascending: false });

  if (statError) {
    throw new Error(statError.message);
  }

  const stats = (statRows ?? []) as { score: number | null; heart_rate: number | null }[];

  const { data: dbSessions, error: sessionsError } = await supabase
    .from('stress_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const recentSessions: StressSessionItem[] = (dbSessions ?? []).map((row: any) => {
    const score = Number(row.score ?? 0);
    return {
      id: String(row.id),
      score,
      title: `${levelForScore(score)} Stress`,
      date: row.created_at ? formatDate(row.created_at) : '',
      status: row.stress_level ?? levelForScore(score),
      statusColor: colorForScore(score),
      heartRate: row.heart_rate ?? undefined,
      surveyScore: row.survey_score ?? undefined,
      emotion: row.emotion ?? undefined,
      reactionTimeMs: row.reaction_time_ms ?? undefined,
      faceConfidencePercent: row.face_confidence ?? undefined,
      notes: row.notes ?? '',
    };
  });

  const { data: dbNotifications, error: notificationsError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (notificationsError) {
    throw new Error(notificationsError.message);
  }

  const notifications: NotificationItem[] = (dbNotifications ?? []).map((row: any) => ({
    id: String(row.id),
    title: row.title,
    message: row.message,
    time: timeAgo(row.created_at),
    read: Boolean(row.read),
    type: row.type === 'alert' || row.type === 'appointment' ? row.type : 'info',
  }));

  const latestScore = recentSessions.length > 0 ? recentSessions[0].score : null;
  const latestLevel = latestScore !== null ? levelForScore(latestScore) : null;

  let latestTrend: DashboardMetrics['latestTrend'] = null;
  if (recentSessions.length >= 2) {
    const delta = recentSessions[0].score - recentSessions[1].score;
    latestTrend = delta > 2 ? 'Increasing' : delta < -2 ? 'Decreasing' : 'Stable';
  }

  const rated = stats.filter(r => typeof r.score === 'number');
  const avgStressScore = rated.length > 0
    ? Math.round(rated.reduce((acc, r) => acc + (r.score as number), 0) / rated.length)
    : null;

  const withHeart = stats.filter(r => typeof r.heart_rate === 'number');
  const avgHeartRate = withHeart.length > 0
    ? Math.round(withHeart.reduce((acc, r) => acc + (r.heart_rate as number), 0) / withHeart.length)
    : null;

  return {
    userName,
    userEmail,
    userInitials,
    greetingDate: formatGreetingDate(),
    yearLevel: profile?.year_level ?? null,
    livingSituation: profile?.living_situation ?? null,
    healthConditions: conditions,
    metrics: {
      latestScore,
      latestLevel,
      latestTrend,
      avgHeartRate,
      avgHeartRateStatus:
        avgHeartRate !== null
          ? avgHeartRate > 80
            ? 'Slightly Elevated'
            : 'Normal Range'
          : 'No data yet',
      avgStressScore,
      avgStressStatus:
        avgStressScore !== null
          ? avgStressScore > 60
            ? 'High Overall'
            : avgStressScore > 35
              ? 'Moderate Overall'
              : 'Low Overall'
          : 'No data yet',
      totalAssessments: stats.length,
    },
    recentSessions,
    notifications,
  };
};

export const saveNewStressSession = async (
  score: number,
  notes: string = 'User completed analysis session.',
  heartRate?: number,
  surveyScore?: number,
  reactionTimeMs?: number,
  faceConfidencePercent?: number,
): Promise<StressSessionItem> => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const status = levelForScore(score);
  const title = `${status} Stress`;

  const { data: inserted, error } = await supabase
    .from('stress_sessions')
    .insert({
      user_id: user.id,
      score,
      stress_level: status,
      heart_rate: heartRate ?? null,
      survey_score: surveyScore ?? null,
      reaction_time_ms: reactionTimeMs ?? null,
      face_confidence: faceConfidencePercent ?? null,
      notes,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Could not save your assessment result.');
  }

  if (status === 'High') {
    // Non-critical: a failed notification must not undo a saved assessment.
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'High Stress Alert',
      message: `Your latest stress check recorded a score of ${score}. Consider taking a 5-minute breathing exercise.`,
      type: 'alert',
    });
    void notificationError;
  }

  // Non-critical side effect: growing the study plant (idempotent per day).
  try {
    await recordPlantSession();
  } catch (e) {
    void e;
  }

  const row: any = inserted;
  return {
    id: String(row.id),
    score,
    title,
    date: row.created_at ? formatDate(row.created_at) : '',
    status,
    statusColor: colorForScore(score),
    heartRate: heartRate ?? undefined,
    surveyScore: surveyScore ?? undefined,
    reactionTimeMs: reactionTimeMs ?? undefined,
    faceConfidencePercent: faceConfidencePercent ?? undefined,
    notes,
  };
};
