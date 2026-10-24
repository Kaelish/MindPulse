import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { resolveProfileAvatarUrl } from './profileAvatar';

export interface DoctorProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  /** Derived from middleName; this is what the sidebar and header card show. */
  middleInitial: string;
  title: string;
  preferredLanguage: string;
  email: string;
  phone: string;
  licenseId: string;
  specialty: string;
  department: string;
  yearsExperience: string;
  startDate: string;
  dob: string;
  gender: string;
  homeAddress: string;
  clinicAddress: string;
  bio: string;
  avatarUrl: string | null;
  isVerified?: boolean;
}

const emptyProfile = (userId: string): DoctorProfileData => ({
  userId,
  firstName: '',
  lastName: '',
  middleName: '',
  middleInitial: '',
  title: '',
  preferredLanguage: 'English',
  email: '',
  phone: '',
  licenseId: '',
  specialty: '',
  department: '',
  yearsExperience: '',
  startDate: '',
  dob: '',
  gender: '',
  homeAddress: '',
  clinicAddress: '',
  bio: '',
  avatarUrl: null,
  isVerified: false,
});

const parseExtras = (raw: string | null) => {
  if (!raw) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const metadataText = (metadata: Record<string, unknown>, key: string): string => text(metadata[key]);

/** True when PostgREST rejects a column the project has not migrated yet. */
const isMissingColumn = (message: string): boolean =>
  /could not find the '.*' column|column .* does not exist|schema cache/i.test(message);

const initialOf = (middleName: string): string =>
  middleName.trim() ? middleName.trim().charAt(0).toUpperCase() : '';

/**
 * Loads the signed-in doctor's profile from profiles + doctor_profiles.
 *
 * `select('*')` is deliberate: the personal-information columns are added by
 * migration 0028, and a project that has not applied it yet must still render
 * the profile (falling back to auth metadata and the legacy JSON extras).
 */
export async function fetchDoctorProfile(): Promise<DoctorProfileData> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
  }
  const userId = await requireUserId();
  const { data: authData } = await supabase.auth.getUser();
  const metadata = (authData.user?.user_metadata ?? {}) as Record<string, unknown>;

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profileRow) throw new Error('Your profile could not be loaded.');

  const { data: doctorRow, error: doctorError } = await supabase
    .from('doctor_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (doctorError) throw new Error(doctorError.message);

  const row = profileRow as Record<string, unknown>;
  const doctor = (doctorRow ?? {}) as Record<string, unknown>;
  const extras = parseExtras(typeof doctor.availability_notes === 'string' ? doctor.availability_notes : null);

  const middleName =
    text(row.middle_name)
    || text(extras.middleName)
    || text(extras.middleInitial)
    || text(row.mi)
    || metadataText(metadata, 'middle_name')
    || metadataText(metadata, 'mi');
  const middleInitial =
    initialOf(middleName)
    || text(row.mi)
    || text(extras.middleInitial)
    || metadataText(metadata, 'mi');

  return {
    ...emptyProfile(userId),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    middleName,
    middleInitial,
    title: text(doctor.title) || text(extras.title) || metadataText(metadata, 'title'),
    preferredLanguage: text(extras.preferredLanguage) || 'English',
    email: text(row.email) || text(authData.user?.email),
    department: text(row.department),
    phone:
      text(doctor.contact_number)
      || text(row.phone)
      || metadataText(metadata, 'contact_number')
      || metadataText(metadata, 'phone'),
    licenseId: text(doctor.license_no) || metadataText(metadata, 'license_no'),
    specialty: text(doctor.specialization) || metadataText(metadata, 'specialization'),
    yearsExperience: text(extras.yearsExperience),
    startDate: text(extras.startDate),
    dob: text(row.birth_date) || text(extras.dob) || metadataText(metadata, 'birth_date'),
    gender: text(row.sex) || text(extras.gender) || metadataText(metadata, 'sex'),
    homeAddress:
      text(row.home_address)
      || text(extras.homeAddress)
      || text(extras.streetAddress)
      || metadataText(metadata, 'home_address'),
    clinicAddress:
      text(doctor.clinic_address)
      || text(extras.clinicAddress)
      || metadataText(metadata, 'clinic_address'),
    bio: text(doctor.bio) || metadataText(metadata, 'bio'),
    avatarUrl: await resolveProfileAvatarUrl(authData.user?.user_metadata),
    isVerified: doctor.is_verified === true,
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
    const middleName = profile.middleName.trim();
    const middleInitial = initialOf(middleName) || profile.middleInitial.trim().toUpperCase();

    const baseProfile: Record<string, unknown> = {
      first_name: profile.firstName.trim(),
      last_name: profile.lastName.trim(),
      email: profile.email.trim(),
      department: profile.department.trim() || null,
      mi: middleInitial || null,
      birth_date: profile.dob.trim() || null,
      sex: profile.gender.trim() || null,
    };
    const extendedProfile: Record<string, unknown> = {
      ...baseProfile,
      middle_name: middleName || null,
      home_address: profile.homeAddress.trim() || null,
    };

    let { error: profileError } = await supabase
      .from('profiles')
      .update(extendedProfile)
      .eq('id', userId);
    if (profileError && isMissingColumn(profileError.message)) {
      // Migration 0028 has not been applied: the JSON extras still carry these
      // values, so the save must not fail just because the columns are absent.
      ({ error: profileError } = await supabase
        .from('profiles')
        .update(baseProfile)
        .eq('id', userId));
    }
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

    const availabilityNotes = JSON.stringify({
      middleName,
      middleInitial,
      title: profile.title,
      preferredLanguage: profile.preferredLanguage,
      yearsExperience: profile.yearsExperience,
      startDate: profile.startDate,
      dob: profile.dob,
      gender: profile.gender,
      homeAddress: profile.homeAddress,
      streetAddress: profile.homeAddress,
      clinicAddress: profile.clinicAddress,
      bio: profile.bio,
    });

    const baseDoctor: Record<string, unknown> = {
      user_id: userId,
      specialization: profile.specialty.trim() || null,
      contact_number: profile.phone.trim() || null,
      license_no: profile.licenseId.trim() || null,
      bio: profile.bio.trim() || null,
      availability_notes: availabilityNotes,
    };
    const extendedDoctor: Record<string, unknown> = {
      ...baseDoctor,
      title: profile.title.trim() || null,
      clinic_address: profile.clinicAddress.trim() || null,
    };

    let { error: upsertError } = await supabase.from('doctor_profiles').upsert(
      extendedDoctor,
      { onConflict: 'user_id' },
    );
    if (upsertError && isMissingColumn(upsertError.message)) {
      ({ error: upsertError } = await supabase.from('doctor_profiles').upsert(
        baseDoctor,
        { onConflict: 'user_id' },
      ));
    }
    if (upsertError) return { success: false, message: upsertError.message };

    return { success: true, message: 'Profile saved.' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
