import { supabase } from '../supabase/client';

export type AppRole = 'student' | 'doctor' | 'admin' | 'pending' | null;

/**
 * Throws when nobody is signed in. Returns the authenticated user's id —
 * the single source of truth for "who is acting" across the doctor services.
 */
export const requireUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!data.user) {
    throw new Error('You must be signed in to do that.');
  }
  return data.user.id;
};

/**
 * Current signed-in role from profiles, or null when unavailable.
 *
 * Doctors who have not been approved by the administrator get `'pending'`:
 * the mobile portal stays locked until doctor_profiles.is_verified is true
 * (approve_doctor / admin dashboard is the only way to set it — RLS blocks
 * self-verification). Same contract as the web session service.
 */
export const getCurrentUserRole = async (): Promise<AppRole> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
    const role = profile?.role as 'student' | 'doctor' | 'admin' | null;
    if (role !== 'doctor') return role;
    const { data: doctor, error: doctorError } = await supabase
      .from('doctor_profiles')
      .select('is_verified')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (!doctorError && doctor && doctor.is_verified === false) return 'pending';
    return 'doctor';
  } catch {
    return null;
  }
};
