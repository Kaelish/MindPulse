import { supabase } from '../supabase/client';
import { ApiResponse, Appointment, DoctorProfile } from '../types/supabase';

export interface DoctorSlot {
  id: string;
  doctor_id: string;
  date: string;
  time: string;
  doctor_name: string;
  specialty: string;
}

export const fetchAvailableDoctors = async (): Promise<ApiResponse<DoctorProfile[]>> => {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .limit(10);

    if (error) {
      return {
        data: null,
        error: error.message,
        loading: false,
      };
    }

    return {
      data: (data ?? []) as DoctorProfile[],
      error: null,
      loading: false,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load doctors',
      loading: false,
    };
  }
};

export const fetchRecommendedSlots = async (): Promise<ApiResponse<DoctorSlot[]>> => {
  try {
    const { data, error } = await supabase
      .from('doctor_slots')
      .select('*')
      .limit(8);

    if (error) {
      return {
        data: null,
        error: error.message,
        loading: false,
      };
    }

    const mapped = (data ?? []) as Array<{
      id: string;
      doctor_id: string;
      slot_date: string;
      slot_time: string;
      doctor_name?: string;
      specialty?: string;
    }>;

    return {
      data: mapped.map((slot) => ({
        id: slot.id,
        doctor_id: slot.doctor_id,
        date: slot.slot_date,
        time: slot.slot_time,
        doctor_name: slot.doctor_name ?? 'Available doctor',
        specialty: slot.specialty ?? 'General care',
      })),
      error: null,
      loading: false,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load available slots',
      loading: false,
    };
  }
};

export const createAppointment = async (
  appointment: Omit<Appointment, 'id' | 'created_at'>,
): Promise<ApiResponse<Appointment>> => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: error.message,
        loading: false,
      };
    }

    return {
      data: data as Appointment,
      error: null,
      loading: false,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to create appointment',
      loading: false,
    };
  }
};
