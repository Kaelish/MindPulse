import { supabase } from '../supabase/client';

export interface DoctorProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseId: string;
  specialty: string;
  dob: string;
  gender: string;
  streetAddress: string;
  isVerified?: boolean;
}

export const DEFAULT_DOCTOR_ID = '1b64dd8f-48f1-4298-ac06-61377665e668';

export const initialDoctorData: DoctorProfileData = {
  userId: DEFAULT_DOCTOR_ID,
  firstName: 'Monroe',
  lastName: 'Leclair',
  email: 'dr.monroeLeclair@gmail.com',
  phone: '+1 (555) 987-6543',
  licenseId: 'PSY-CA-12345',
  specialty: 'Clinical Psychologist',
  dob: '20/08/1985',
  gender: 'Female',
  streetAddress: '456 Medical Plaza',
  isVerified: true,
};

/**
 * Fetch Doctor Profile from Supabase tables (USER + DOCTOR_PROFILES)
 */
export async function fetchDoctorProfile(userId: string = DEFAULT_DOCTOR_ID): Promise<DoctorProfileData> {
  if (!supabase) return initialDoctorData;

  try {
    // 1. Fetch from USER table
    const { data: userData, error: userErr } = await supabase
      .from('USER')
      .select('USER_ID, FIRST_NAME, LAST_NAME, EMAIL')
      .eq('USER_ID', userId)
      .maybeSingle();

    if (userErr) {
      console.warn('Error fetching USER for doctor profile:', userErr.message);
    }

    // 2. Fetch from DOCTOR_PROFILES table
    const { data: profData, error: profErr } = await supabase
      .from('DOCTOR_PROFILES')
      .select('SPECIALIZATION, CONTACT_NUMBER, LICENSE_NO, AVAILABILITY_NOTES, IS_VERIFIED')
      .eq('USER_ID', userId)
      .maybeSingle();

    if (profErr) {
      console.warn('Error fetching DOCTOR_PROFILES for doctor:', profErr.message);
    }

    let extra: { dob?: string; gender?: string; street_address?: string } = {};
    if (profData?.AVAILABILITY_NOTES) {
      try {
        extra = JSON.parse(profData.AVAILABILITY_NOTES);
      } catch (e) {
        // If string note
      }
    }

    return {
      userId,
      firstName: userData?.FIRST_NAME || initialDoctorData.firstName,
      lastName: userData?.LAST_NAME || initialDoctorData.lastName,
      email: userData?.EMAIL || initialDoctorData.email,
      phone: profData?.CONTACT_NUMBER || initialDoctorData.phone,
      licenseId: profData?.LICENSE_NO || initialDoctorData.licenseId,
      specialty: profData?.SPECIALIZATION || initialDoctorData.specialty,
      dob: extra.dob || initialDoctorData.dob,
      gender: extra.gender || initialDoctorData.gender,
      streetAddress: extra.street_address || initialDoctorData.streetAddress,
      isVerified: profData?.IS_VERIFIED ?? true,
    };
  } catch (err) {
    console.error('Failed to fetch doctor profile:', err);
    return initialDoctorData;
  }
}

/**
 * Save / Update Doctor Profile to Supabase
 */
export async function saveDoctorProfile(profile: DoctorProfileData): Promise<{ success: boolean; message?: string }> {
  if (!supabase) {
    return { success: true, message: 'Saved locally (Supabase not configured).' };
  }

  try {
    // 1. Update USER table
    const { error: userErr } = await supabase
      .from('USER')
      .update({
        FIRST_NAME: profile.firstName,
        LAST_NAME: profile.lastName,
        EMAIL: profile.email,
      })
      .eq('USER_ID', profile.userId);

    if (userErr) {
      console.error('Error updating USER table:', userErr);
    }

    // 2. Format JSON extra data
    const extraNotes = JSON.stringify({
      dob: profile.dob,
      gender: profile.gender,
      street_address: profile.streetAddress,
    });

    // 3. Check if DOCTOR_PROFILES row exists
    const { data: existingProf } = await supabase
      .from('DOCTOR_PROFILES')
      .select('DOCTOR_PROFILE_ID')
      .eq('USER_ID', profile.userId)
      .maybeSingle();

    if (existingProf) {
      // Update existing record
      const { error: updateErr } = await supabase
        .from('DOCTOR_PROFILES')
        .update({
          SPECIALIZATION: profile.specialty,
          CONTACT_NUMBER: profile.phone,
          LICENSE_NO: profile.licenseId,
          AVAILABILITY_NOTES: extraNotes,
          IS_VERIFIED: profile.isVerified ?? true,
        })
        .eq('USER_ID', profile.userId);

      if (updateErr) {
        console.error('Error updating DOCTOR_PROFILES table:', updateErr);
        return { success: false, message: updateErr.message };
      }
    } else {
      // Insert new record
      const { error: insertErr } = await supabase
        .from('DOCTOR_PROFILES')
        .insert([
          {
            USER_ID: profile.userId,
            SPECIALIZATION: profile.specialty,
            CONTACT_NUMBER: profile.phone,
            LICENSE_NO: profile.licenseId,
            AVAILABILITY_NOTES: extraNotes,
            IS_VERIFIED: profile.isVerified ?? true,
          },
        ]);

      if (insertErr) {
        console.error('Error inserting DOCTOR_PROFILES table:', insertErr);
        return { success: false, message: insertErr.message };
      }
    }

    return { success: true, message: 'Doctor profile updated in Supabase successfully!' };
  } catch (err: any) {
    console.error('Failed to save doctor profile:', err);
    return { success: false, message: err.message || 'Unknown error' };
  }
}
