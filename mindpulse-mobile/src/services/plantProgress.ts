import { supabase } from '../supabase/client';

export type PlantProgress = {
  currentStage: string;
  currentStreak: number;
  totalGrowthPoints: number;
  lastSessionDate: string | null;
};

const defaultProgress: PlantProgress = {
  currentStage: 'Bare Pot',
  currentStreak: 0,
  totalGrowthPoints: 0,
  lastSessionDate: null,
};

export async function fetchPlantProgress(): Promise<PlantProgress> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const { data, error } = await supabase
    .from('MIND_PLANT_PROGRESS')
    .select('CURRENT_STAGE, CURRENT_STREAK, TOTAL_GROWTH_POINTS, LAST_SESSION_DATE')
    .eq('USER_ID', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    // Legitimate new-user state: no plant row has been created yet.
    return defaultProgress;
  }
  return {
    currentStage: data.CURRENT_STAGE || defaultProgress.currentStage,
    currentStreak: data.CURRENT_STREAK ?? defaultProgress.currentStreak,
    totalGrowthPoints: data.TOTAL_GROWTH_POINTS ?? defaultProgress.totalGrowthPoints,
    lastSessionDate: data.LAST_SESSION_DATE || null,
  };
}

export async function recordPlantSession(): Promise<PlantProgress> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const current = await fetchPlantProgress();
  const today = new Date().toISOString().slice(0, 10);
  // LAST_SESSION_DATE may be stored as a date or a timestamp; compare the day only.
  const alreadyRecordedToday = (current.lastSessionDate || '').slice(0, 10) === today;
  const nextStreak = alreadyRecordedToday ? current.currentStreak : current.currentStreak + 1;
  const nextPoints = alreadyRecordedToday
    ? current.totalGrowthPoints
    : current.totalGrowthPoints + 10;
  const nextStage =
    nextStreak >= 25
      ? 'Full Bloom'
      : nextStreak >= 15
        ? 'Mature Plant'
        : nextStreak >= 10
          ? 'Young Plant'
          : nextStreak >= 5
            ? 'Sprout'
            : nextStreak >= 1
              ? 'Seedling'
              : 'Bare Pot';

  const next: PlantProgress = {
    currentStage: nextStage,
    currentStreak: nextStreak,
    totalGrowthPoints: nextPoints,
    lastSessionDate: today,
  };

  const { error } = await supabase
    .from('MIND_PLANT_PROGRESS')
    .upsert(
      {
        USER_ID: user.id,
        CURRENT_STAGE: next.currentStage,
        CURRENT_STREAK: next.currentStreak,
        TOTAL_GROWTH_POINTS: next.totalGrowthPoints,
        LAST_SESSION_DATE: next.lastSessionDate,
      },
      { onConflict: 'USER_ID' },
    );

  if (error) {
    throw new Error(error.message);
  }
  return next;
}
