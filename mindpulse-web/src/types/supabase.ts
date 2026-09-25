// Canonical Supabase row types.
// Mirrors supabase/migrations/0001_canonical_schema.sql – keep in sync.

export type AppRole = 'student' | 'doctor' | 'admin';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  year_level: string | null;
  program: string | null;
  living_situation: string | null;
  student_no: string | null;
  department: string | null;
  birth_date: string | null;
  sex: string | null;
  mental_conditions: string[];
  physical_conditions: string[];
  lifestyle_habits: string[];
  none_apply: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorProfile {
  id: string;
  user_id: string;
  specialization: string | null;
  contact_number: string | null;
  license_no: string | null;
  is_verified: boolean;
  bio: string | null;
  tags: string[];
  availability_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type StressLevel = 'Low' | 'Moderate' | 'High';

export interface StressSession {
  id: string;
  user_id: string;
  score: number | null;
  stress_level: StressLevel | null;
  heart_rate: number | null;
  survey_score: number | null;
  emotion: string | null;
  reaction_time_ms: number | null;
  face_confidence: number | null;
  notes: string | null;
  created_at: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_for: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ChatSender = 'patient' | 'doctor';

export interface ChatMessage {
  id: string;
  patient_id: string;
  clinician_id: string;
  sender: ChatSender;
  text: string;
  created_at: string;
}

export type VideoSessionStatus = 'pending' | 'active' | 'live' | 'ended' | 'connecting';

export interface VideoSession {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  room_name: string;
  meeting_url: string | null;
  token: string | null;
  status: VideoSessionStatus;
  created_at: string;
}

export type NotificationType = 'alert' | 'info' | 'appointment';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

export interface MigrationReportRow {
  id: string;
  legacy_table: string;
  legacy_id: string | null;
  legacy_email: string | null;
  problem: string;
  created_at: string;
}

// ---- Joined view models (profiles ⋈ doctor_profiles) ------------------------

export interface DoctorDirectoryEntry {
  id: string;
  full_name: string | null;
  email: string | null;
  specialization: string | null;
  bio: string | null;
  tags: string[];
  availability_notes: string | null;
  contact_number: string | null;
  is_verified: boolean;
}

export interface PatientCaseEntry {
  id: string;
  full_name: string | null;
  email: string | null;
  year_level: string | null;
  program: string | null;
  onboarding_complete: boolean;
  last_session_at: string | null;
  last_score: number | null;
  last_stress_level: StressLevel | null;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}
