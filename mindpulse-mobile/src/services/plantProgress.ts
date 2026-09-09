import { supabase } from '../supabase/client';

export type PlantProgress = {
  currentStage: string;
  currentStreak: number;
  totalGrowthPoints: number;
  lastSessionDate: string | null;
};

const defaultProgress: PlantProgress = {
  currentStage: 'Seedling',
  currentStreak: 1,
  totalGrowthPoints: 10,
  lastSessionDate: null,
};

export async function fetchPlantProgress(): Promise<PlantProgress> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return defaultProgress;

  const { data, error } = await supabase
    .from('MIND_PLANT_PROGRESS')
    .select('CURRENT_STAGE, CURRENT_STREAK, TOTAL_GROWTH_POINTS, LAST_SESSION_DATE')
    .eq('USER_ID', user.id)
    .maybeSingle();

  if (error || !data) return defaultProgress;
  return {
    currentStage: data.CURRENT_STAGE || defaultProgress.currentStage,
    currentStreak: data.CURRENT_STREAK ?? defaultProgress.currentStreak,
    totalGrowthPoints: data.TOTAL_GROWTH_POINTS ?? defaultProgress.totalGrowthPoints,
    lastSessionDate: data.LAST_SESSION_DATE || null,
  };
}

export async function recordPlantSession(): Promise<PlantProgress> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return defaultProgress;

  const current = await fetchPlantProgress();
  const today = new Date().toISOString().slice(0, 10);
  const alreadyRecordedToday = current.lastSessionDate === today;
  const nextStreak = alreadyRecordedToday ? current.currentStreak : current.currentStreak + 1;
  const nextPoints = alreadyRecordedToday ? current.totalGrowthPoints : current.totalGrowthPoints + 10;
  const nextStage = nextStreak >= 25 ? 'Full Bloom' : nextStreak >= 15 ? 'Mature Plant' : nextStreak >= 10 ? 'Young Plant' : nextStreak >= 5 ? 'Sprout' : 'Seedling';

  const next = { currentStage: nextStage, currentStreak: nextStreak, totalGrowthPoints: nextPoints, lastSessionDate: today };
  const { error } = await supabase.from('MIND_PLANT_PROGRESS').upsert({
    USER_ID: user.id,
    CURRENT_STAGE: next.currentStage,
    CURRENT_STREAK: next.currentStreak,
    TOTAL_GROWTH_POINTS: next.totalGrowthPoints,
    LAST_SESSION_DATE: next.lastSessionDate,
  }, { onConflict: 'USER_ID' });

  if (error) return current;
  return next;
}
