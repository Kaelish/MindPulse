import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { resolveProfileAvatarUrl } from './profileAvatar';

const notConfigured = () =>
  new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');

export interface OwnProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  department: string | null;
  program: string | null;
  year_level: string | null;
  student_no: string | null;
  sex: string | null;
  birth_date: string | null;
  living_situation: string | null;
  avatar_url: string | null;
  preferred_title: string | null;
  clinic_address: string | null;
  administrative_title: string | null;
  medical_specialization: string | null;
  professional_license_no: string | null;
  clinic_name: string | null;
  privacy_scope: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

/** Fields a user may edit on their own profile (role is never writable here). */
export type OwnProfilePatch = Partial<
  Pick<
    OwnProfile,
    | 'first_name' | 'last_name' | 'email' | 'phone' | 'department' | 'program' | 'year_level' | 'student_no' | 'sex' | 'living_situation'
    | 'preferred_title' | 'clinic_address' | 'administrative_title' | 'medical_specialization'
    | 'professional_license_no' | 'clinic_name' | 'privacy_scope'
  >
>;

export const fetchOwnProfile = async (): Promise<OwnProfile> => {
  if (!supabase) throw notConfigured();
  const userId = await requireUserId();
  const { data: authData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, email, phone, role, department, program, year_level, student_no, sex, birth_date, living_situation, onboarding_complete, created_at',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Your profile row does not exist yet. Sign out and in again, or contact an administrator.');
  const metadata = authData.user?.user_metadata ?? {};
  return {
    ...data,
    avatar_url: await resolveProfileAvatarUrl(authData.user?.user_metadata),
    preferred_title: metadata.preferred_title ?? null,
    clinic_address: metadata.clinic_address ?? null,
    administrative_title: metadata.administrative_title ?? null,
    medical_specialization: metadata.medical_specialization ?? null,
    professional_license_no: metadata.professional_license_no ?? null,
    clinic_name: metadata.clinic_name ?? null,
    privacy_scope: metadata.privacy_scope ?? null,
  } as OwnProfile;
};

export const updateOwnProfile = async (patch: OwnProfilePatch): Promise<void> => {
  if (!supabase) throw notConfigured();
  const userId = await requireUserId();
  if (patch.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: patch.email });
    if (emailError) throw new Error(emailError.message);
  }
  const metadataFields = [
    'preferred_title', 'clinic_address', 'administrative_title', 'medical_specialization',
    'professional_license_no', 'clinic_name', 'privacy_scope',
  ] as const;
  const metadataPatch = Object.fromEntries(metadataFields
    .filter((field) => patch[field] !== undefined)
    .map((field) => [field, patch[field]]));
  if (Object.keys(metadataPatch).length > 0) {
    const { error: metadataError } = await supabase.auth.updateUser({ data: metadataPatch });
    if (metadataError) throw new Error(metadataError.message);
  }
  const databasePatch = Object.fromEntries(Object.entries(patch)
    .filter(([field, value]) => !metadataFields.includes(field as typeof metadataFields[number]) && value !== undefined));
  const { error } = await supabase.from('profiles').update(databasePatch).eq('id', userId);
  if (error) throw new Error(error.message);
};

/** Changes the signed-in user's password through Supabase Auth. */
export const changeOwnPassword = async (newPassword: string): Promise<void> => {
  if (!supabase) throw notConfigured();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
};

/**
 * Reactivates the signed-in account (0042): clears is_deactivated,
 * deactivated_at, deleted_at and deleted_by so the account is active again.
 *
 * Records the user soft-deleted BEFORE deactivating are deliberately left
 * alone — they stay in Recently Deleted until restored one by one.
 * The profiles UPDATE policy is ownership-only, so writing NULL back is
 * permitted (there is no active-row predicate in its WITH CHECK).
 */
export const reactivateOwnAccount = async (): Promise<void> => {
  if (!supabase) throw notConfigured();
  const userId = await requireUserId();
  const { error } = await supabase
    .from('profiles')
    .update({
      is_deactivated: false,
      deactivated_at: null,
      deleted_at: null,
      deleted_by: null,
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
};
