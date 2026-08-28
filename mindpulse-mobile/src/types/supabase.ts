export interface PatientProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DoctorProfile {
  id: string;
  full_name: string;
  specialty?: string;
  email: string;
  avatar_url?: string;
  hospital_name?: string;
  created_at?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_for: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  created_at?: string;
}

export interface VideoCallSession {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  room_name: string;
  status: 'pending' | 'active' | 'ended';
  started_at?: string;
  ended_at?: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}
