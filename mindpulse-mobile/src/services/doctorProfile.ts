import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { normalizePhoneNumber, validatePhoneNumber } from './internationalPhone';

export interface DoctorProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseId: string;
  specialty: string;
  department: string;
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
  isVerified: false,
});

/** Loads the signed-in doctor's profile from profiles + doctor_profiles. */
export const fetchDoctorProfile = async (): Promise<DoctorProfileData> => {
  const userId = await requireUserId();

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, email, department')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profileRow) throw new Error('Your profile could not be loaded.');

  const { data: doctorRow, error: doctorError } = await supabase
    .from('doctor_profiles')
    .select('specialization, contact_number, license_no, is_verified')
    .eq('user_id', userId)
    .maybeSingle();
  if (doctorError) throw new Error(doctorError.message);

  return {
    ...emptyProfile(userId),
    firstName: profileRow.first_name || '',
    lastName: profileRow.last_name || '',
    email: profileRow.email || '',
    department: profileRow.department || '',
    phone: doctorRow?.contact_number || '',
    licenseId: doctorRow?.license_no || '',
    specialty: doctorRow?.specialization || '',
    isVerified: doctorRow?.is_verified ?? false,
  };
};

/** Saves the signed-in doctor's profile. Never fabricates a success. */
export const saveDoctorProfile = async (
  profile: DoctorProfileData,
): Promise<{ success: boolean; message?: string }> => {
  const phoneError = validatePhoneNumber(profile.phone);
  if (phoneError) return { success: false, message: phoneError };
  try {
    const userId = await requireUserId();

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: profile.firstName.trim(),
        last_name: profile.lastName.trim(),
        department: profile.department.trim() || null,
      })
      .eq('id', userId);
    if (profileError) return { success: false, message: profileError.message };

    const { error: upsertError } = await supabase.from('doctor_profiles').upsert(
      {
        user_id: userId,
        specialization: profile.specialty.trim() || null,
        contact_number: normalizePhoneNumber(profile.phone) || null,
        license_no: profile.licenseId.trim() || null,
      },
      { onConflict: 'user_id' },
    );
    if (upsertError) return { success: false, message: upsertError.message };

    return { success: true, message: 'Profile saved.' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
};

/** Changes the signed-in user's password via Supabase auth. */
export const changeAccountPassword = async (newPassword: string): Promise<{ success: boolean; message?: string }> => {
  if (newPassword.length < 12 || !/[^A-Za-z0-9]/.test(newPassword)) {
    return {
      success: false,
      message: 'Password must be at least 12 characters and include a special character.',
    };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Password updated.' };
};
