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
  latestScore: number;
  latestLevel: 'Low' | 'Moderate' | 'High';
  latestTrend: 'Increasing' | 'Decreasing' | 'Stable';
  avgHeartRate: number;
  avgHeartRateStatus: string;
  avgStressScore: number;
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
  metrics: DashboardMetrics;
  recentSessions: StressSessionItem[];
  notifications: NotificationItem[];
}

export const initialMockSessions: StressSessionItem[] = [
  {
    id: 's-101',
    score: 68,
    title: 'High Stress',
    date: 'March 18, 2026',
    status: 'High',
    statusColor: 'pink',
    heartRate: 88,
    surveyScore: 68,
    emotion: 'Anxious',
    reactionTimeMs: 430,
    faceConfidencePercent: 71,
    notes: 'Work deadline tension detected. Elevated heart rate and facial strain.',
  },
  {
    id: 's-102',
    score: 42,
    title: 'Moderate Stress',
    date: 'March 14, 2026',
    status: 'Moderate',
    statusColor: 'yellow',
    heartRate: 76,
    surveyScore: 45,
    emotion: 'Calm',
    reactionTimeMs: 380,
    faceConfidencePercent: 84,
    notes: 'Post-exercise recovery session. Steady breathing pattern.',
  },
  {
    id: 's-103',
    score: 85,
    title: 'High Stress',
    date: 'March 10, 2026',
    status: 'High',
    statusColor: 'pink',
    heartRate: 94,
    surveyScore: 82,
    emotion: 'Stressed',
    reactionTimeMs: 490,
    faceConfidencePercent: 68,
    notes: 'Sleep deprivation identified from survey inputs.',
  },
  {
    id: 's-104',
    score: 22,
    title: 'Low Stress',
    date: 'March 5, 2026',
    status: 'Low',
    statusColor: 'green',
    heartRate: 64,
    surveyScore: 20,
    emotion: 'Relaxed',
    reactionTimeMs: 320,
    faceConfidencePercent: 92,
    notes: 'Optimal relaxation state after morning meditation.',
  },
  {
    id: 's-105',
    score: 55,
    title: 'Moderate Stress',
    date: 'February 28, 2026',
    status: 'Moderate',
    statusColor: 'yellow',
    heartRate: 80,
    surveyScore: 58,
    emotion: 'Neutral',
    reactionTimeMs: 410,
    faceConfidencePercent: 78,
    notes: 'Midday check-in. Normal physiological metrics.',
  },
];

export const initialMockNotifications: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'High Stress Alert',
    message: 'Your latest stress check recorded a score of 68. Consider taking a 5-minute breathing exercise.',
    time: '10 mins ago',
    read: false,
    type: 'alert',
  },
  {
    id: 'n-2',
    title: 'Appointment Reminder',
    message: 'Upcoming consultation with Dr. Alicia Romero tomorrow at 9:30 AM.',
    time: '2 hours ago',
    read: false,
    type: 'appointment',
  },
  {
    id: 'n-3',
    title: 'Daily Check Available',
    message: 'Time for your afternoon stress assessment pipeline.',
    time: 'Yesterday',
    read: true,
    type: 'info',
  },
];

export const fetchDashboardData = async (
  userId: string = 'user-john-doe',
): Promise<PatientDashboardData> => {
  let userName = 'John Doe';
  let userEmail = 'johndoe@gmail.com';
  let userInitials = 'JD';
  let sessions = [...initialMockSessions];

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (profile?.full_name) {
      userName = profile.full_name;
      const parts = userName.split(' ');
      userInitials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : userName.substring(0, 2).toUpperCase();
    }
    if (profile?.email) {
      userEmail = profile.email;
    }

    const { data: dbSessions, error } = await supabase
      .from('stress_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && dbSessions && dbSessions.length > 0) {
      sessions = dbSessions.map((row: any) => ({
        id: String(row.id),
        score: Number(row.score ?? 50),
        title: row.title ?? (row.score > 60 ? 'High Stress' : row.score > 35 ? 'Moderate Stress' : 'Low Stress'),
        date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'March 18, 2026',
        status: row.status ?? (row.score > 60 ? 'High' : row.score > 35 ? 'Moderate' : 'Low'),
        statusColor: row.score > 60 ? 'pink' : row.score > 35 ? 'yellow' : 'green',
        heartRate: row.heart_rate ?? 75,
        surveyScore: row.survey_score ?? row.score ?? 68,
        emotion: row.emotion ?? (row.score > 60 ? 'Anxious' : row.score > 35 ? 'Neutral' : 'Calm'),
        reactionTimeMs: row.reaction_time_ms ?? 430,
        faceConfidencePercent: row.face_confidence ?? 71,
        notes: row.notes ?? '',
      }));
    }
  } catch (e) {
    // Fall back gracefully when Supabase tables are loading or offline
  }

  const latestScore = sessions.length > 0 ? sessions[0].score : 68;
  const latestLevel = latestScore > 60 ? 'High' : latestScore > 35 ? 'Moderate' : 'Low';
  
  const avgHeartRate = Math.round(
    sessions.reduce((acc, s) => acc + (s.heartRate || 78), 0) / (sessions.length || 1),
  );
  
  const avgStressScore = Math.round(
    sessions.reduce((acc, s) => acc + s.score, 0) / (sessions.length || 1),
  );

  return {
    userName,
    userEmail,
    userInitials,
    greetingDate: 'Thursday, 19 March',
    metrics: {
      latestScore,
      latestLevel,
      latestTrend: 'Increasing',
      avgHeartRate,
      avgHeartRateStatus: avgHeartRate > 80 ? 'Slightly Elevated' : 'Normal Range',
      avgStressScore,
      avgStressStatus: avgStressScore > 60 ? 'High Overall' : avgStressScore > 35 ? 'Moderate Overall' : 'Low Overall',
      totalAssessments: sessions.length || 5,
    },
    recentSessions: sessions,
    notifications: initialMockNotifications,
  };
};

export const saveNewStressSession = async (
  score: number,
  notes: string = 'User completed analysis session.',
  heartRate: number = 82,
): Promise<StressSessionItem> => {
  const status: 'Low' | 'Moderate' | 'High' =
    score > 60 ? 'High' : score > 35 ? 'Moderate' : 'Low';
  const statusColor = score > 60 ? 'pink' : score > 35 ? 'yellow' : 'green';
  const title = `${status} Stress`;

  const newSession: StressSessionItem = {
    id: `s-${Date.now()}`,
    score,
    title,
    date: new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    status,
    statusColor,
    heartRate,
    surveyScore: score,
    emotion: score > 60 ? 'Anxious' : score > 35 ? 'Neutral' : 'Calm',
    reactionTimeMs: Math.round(350 + Math.random() * 100),
    faceConfidencePercent: Math.round(70 + Math.random() * 20),
    notes,
  };

  try {
    await supabase.from('stress_sessions').insert({
      score,
      title,
      status,
      heart_rate: heartRate,
      survey_score: newSession.surveyScore,
      emotion: newSession.emotion,
      reaction_time_ms: newSession.reactionTimeMs,
      face_confidence: newSession.faceConfidencePercent,
      notes,
    });
    await recordPlantSession();
  } catch (e) {
    // Graceful offline fallback
  }

  return newSession;
};
