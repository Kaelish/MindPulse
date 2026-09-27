import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { resolveProfileAvatarUrl } from './profileAvatar';

export interface DoctorProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseId: string;
  specialty: string;
  department: string;
  yearsExperience: string;
  startDate: string;
  dob: string;
  gender: string;
  streetAddress: string;
  avatarUrl: string | null;
  isVerified?: boolean;
}

const emptyProfile = (userId: string): DoctorProfileData => ({
  userId,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  licenseId: '',
  specialty: '',
  department: '',
  yearsExperience: '',
  startDate: '',
  dob: '',
  gender: '',
  streetAddress: '',
  avatarUrl: null,
  isVerified: false,
});

const parseExtras = (raw: string | null) => {
  if (!raw) return {} as Partial<DoctorProfileData>;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Partial<DoctorProfileData>)
      : {};
  } catch {
    return {} as Partial<DoctorProfileData>;
  }
};

/** Loads the signed-in doctor's profile from profiles + doctor_profiles. */
export async function fetchDoctorProfile(): Promise<DoctorProfileData> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  const userId = await requireUserId();
  const { data: authData } = await supabase.auth.getUser();

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, email, department')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profileRow) throw new Error('Your profile could not be loaded.');

  const { data: doctorRow, error: doctorError } = await supabase
    .from('doctor_profiles')
    .select('specialization, contact_number, license_no, availability_notes, is_verified')
    .eq('user_id', userId)
    .maybeSingle();
  if (doctorError) throw new Error(doctorError.message);

  const extras = parseExtras(doctorRow?.availability_notes ?? null);

  return {
    ...emptyProfile(userId),
    firstName: profileRow.first_name || '',
    lastName: profileRow.last_name || '',
    email: profileRow.email || '',
    department: profileRow.department || '',
    phone: doctorRow?.contact_number || '',
    licenseId: doctorRow?.license_no || '',
    specialty: doctorRow?.specialization || '',
    yearsExperience: extras.yearsExperience || '',
    startDate: extras.startDate || '',
    dob: extras.dob || '',
    gender: extras.gender || '',
    streetAddress: extras.streetAddress || '',
    avatarUrl: await resolveProfileAvatarUrl(authData.user?.user_metadata),
    isVerified: doctorRow?.is_verified ?? false,
  };
}

/** Saves the signed-in doctor's profile. Never fabricates a success. */
export async function saveDoctorProfile(
  profile: DoctorProfileData,
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured.' };
    }
    const userId = await requireUserId();

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: profile.firstName.trim(),
        last_name: profile.lastName.trim(),
        email: profile.email.trim(),
        department: profile.department.trim() || null,
      })
      .eq('id', userId);
    if (profileError) return { success: false, message: profileError.message };

    // Keep the auth email in sync when the user changed it on the form.
    const { data: authData } = await supabase.auth.getUser();
    const currentAuthEmail = authData.user?.email;
    if (currentAuthEmail && profile.email.trim() && profile.email.trim() !== currentAuthEmail) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: profile.email.trim(),
      });
      if (emailError) {
        return {
          success: false,
          message: `Profile saved, but the login email could not be changed: ${emailError.message}`,
        };
      }
    }

    const { error: upsertError } = await supabase.from('doctor_profiles').upsert(
      {
        user_id: userId,
        specialization: profile.specialty.trim() || null,
        contact_number: profile.phone.trim() || null,
        license_no: profile.licenseId.trim() || null,
        availability_notes: JSON.stringify({
          dob: profile.dob,
          gender: profile.gender,
          streetAddress: profile.streetAddress,
          yearsExperience: profile.yearsExperience,
          startDate: profile.startDate,
        }),
        is_verified: profile.isVerified ?? false,
      },
      { onConflict: 'user_id' },
    );
    if (upsertError) return { success: false, message: upsertError.message };

    return { success: true, message: 'Profile saved.' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
