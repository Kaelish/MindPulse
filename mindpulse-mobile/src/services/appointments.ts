import { supabase } from '../supabase/client';

export interface TelehealthClinician {
  id: string;
  name: string;
  specialty: string;
  avatar: string;
  status: 'Available' | 'Offline';
  bio: string;
  tags: string[];
  email: string;
}

export interface BookedAppointment {
  id: string;
  clinicianId: string;
  clinicianName: string;
  specialty: string;
  selectedDate: string; // e.g. "Aug 31, 2026"
  selectedTime: string; // e.g. "3:30 PM"
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
}

const requireUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return user;
};

export const generateRealLifeDates = (): { label: string; dateStr: string }[] => {
  const dates: { label: string; dateStr: string }[] = [];
  const today = new Date();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : daysOfWeek[d.getDay()];
    dates.push({
      label: dayName,
      dateStr: `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    });
  }

  return dates;
};

const CLINICIAN_SELECT =
  'id, first_name, last_name, full_name, email, doctor_profiles ( specialization, bio, tags )';

const toClinician = (row: any): TelehealthClinician => {
  const embedded = Array.isArray(row.doctor_profiles) ? row.doctor_profiles[0] : row.doctor_profiles;
  const baseName =
    `${row.full_name || ''}`.trim() ||
    `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
    row.email ||
    'Clinician';
  const displayName = /^dr\.?\s/i.test(baseName) ? baseName : `Dr. ${baseName}`;
  const nameParts = displayName.split(/\s+/);
  const avatar =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : displayName.substring(0, 2).toUpperCase();

  return {
    id: String(row.id),
    name: displayName,
    specialty: embedded?.specialization || 'Mental Health Professional',
    avatar,
    status: 'Available',
    bio: embedded?.bio || 'No bio provided yet.',
    tags: Array.isArray(embedded?.tags) ? embedded.tags : [],
    email: row.email || '',
  };
};

export const fetchClinicians = async (): Promise<TelehealthClinician[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(CLINICIAN_SELECT)
    .eq('role', 'doctor')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(toClinician);
};

export const fetchClinicianById = async (id: string): Promise<TelehealthClinician | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(CLINICIAN_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ? toClinician(data) : null;
};

// The Messages tab talks to the doctor of the patient's most recent appointment.
export const fetchConversationClinician = async (): Promise<TelehealthClinician | null> => {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('appointments')
    .select('doctor_id, created_at')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.length === 0) {
    return null;
  }
  return fetchClinicianById(data[0].doctor_id);
};

export const fetchBookedSlotKeys = async (): Promise<Set<string>> => {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('appointments')
    .select('scheduled_for')
    .eq('patient_id', user.id)
    .in('status', ['scheduled', 'confirmed']);

  if (error) {
    throw new Error(error.message);
  }

  // Rows are written by saveBookedAppointment as "<date> at <time>".
  const slotSet = new Set<string>();
  (data ?? []).forEach((row: any) => {
    const parts = String(row.scheduled_for || '').split(' at ');
    if (parts.length === 2 && parts[0] && parts[1]) {
      slotSet.add(`${parts[0]}_${parts[1]}`);
    }
  });
  return slotSet;
};

export const saveBookedAppointment = async (
  appointment: Omit<BookedAppointment, 'id' | 'createdAt'>,
): Promise<BookedAppointment> => {
  const user = await requireUser();

  const { data: inserted, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: user.id,
      doctor_id: appointment.clinicianId,
      scheduled_for: `${appointment.selectedDate} at ${appointment.selectedTime}`,
      status: 'scheduled',
      notes: `Booked session with ${appointment.clinicianName}`,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Could not book the appointment. Please try again.');
  }

  // Non-critical: a notification failure must not undo a booked appointment.
  const { error: patientNoticeError } = await supabase.from('notifications').insert({
    user_id: user.id,
    title: 'Appointment Booked',
    message: `Your session with ${appointment.clinicianName} is set for ${appointment.selectedDate} at ${appointment.selectedTime}.`,
    type: 'appointment',
  });
  void patientNoticeError;

  const { error: doctorNoticeError } = await supabase.from('notifications').insert({
    user_id: appointment.clinicianId,
    title: 'New Appointment Request',
    message: `A student requested a session on ${appointment.selectedDate} at ${appointment.selectedTime}.`,
    type: 'appointment',
  });
  void doctorNoticeError;

  const row: any = inserted;
  return {
    id: String(row.id),
    ...appointment,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
};

export const fetchChatMessages = async (clinicianId: string): Promise<ChatMessage[]> => {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('patient_id', user.id)
    .eq('clinician_id', clinicianId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    sender: row.sender === 'doctor' ? 'doctor' : 'patient',
    text: row.text,
    timestamp: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now',
  }));
};

// The mobile app is the patient app: messages are always sent as the patient.
export const sendChatMessage = async (
  clinicianId: string,
  text: string,
): Promise<ChatMessage> => {
  const user = await requireUser();

  const { data: inserted, error } = await supabase
    .from('chat_messages')
    .insert({
      patient_id: user.id,
      clinician_id: clinicianId,
      sender: 'patient',
      text,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Could not send the message. Please try again.');
  }

  const row: any = inserted;
  return {
    id: String(row.id),
    sender: 'patient',
    text: row.text,
    timestamp: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now',
  };
};
