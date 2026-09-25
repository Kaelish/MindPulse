import { supabase } from '../supabase/client';
import { requireUserId } from './session';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export interface OwnProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  department: string | null;
  program: string | null;
  year_level: string | null;
  student_no: string | null;
  sex: string | null;
  birth_date: string | null;
  living_situation: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

/** Fields a user may edit on their own profile (role is never writable here). */
export type OwnProfilePatch = Partial<
  Pick<
    OwnProfile,
    'first_name' | 'last_name' | 'department' | 'program' | 'year_level' | 'student_no' | 'sex' | 'living_situation'
  >
>;

export const fetchOwnProfile = async (): Promise<OwnProfile> => {
  if (!supabase) throw notConfigured();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, email, role, department, program, year_level, student_no, sex, birth_date, living_situation, onboarding_complete, created_at',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Your profile row does not exist yet. Sign out and in again, or contact an administrator.');
  return data as OwnProfile;
};

export const updateOwnProfile = async (patch: OwnProfilePatch): Promise<void> => {
  if (!supabase) throw notConfigured();
  const userId = await requireUserId();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
};

/** Changes the signed-in user's password through Supabase Auth. */
export const changeOwnPassword = async (newPassword: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
};
