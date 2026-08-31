import { supabase } from '../supabase/client';

export interface WebConsultationItem {
  id: string;
  patientName: string;
  studentId: string;
  scheduledTime: string;
  duration: string;
  status: 'Scheduled' | 'Completed' | 'In progress';
  notes?: string;
  avatarInitials: string;
  patientEmail: string;
}

export interface WebChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
}

export interface ManualBookingData {
  patientName: string;
  age: string;
  patientEmail: string;
  notes: string;
  selectedDate: string;
  selectedTime: string;
}

// Local in-memory store for booked slots (e.g. "Today (Aug 31)_3:30 PM")
export const memoryBookedSlotKeys: Set<string> = new Set(['Today (Aug 31)_3:30 PM', 'Today (Aug 31)_9:00 AM']);

export const initialWebConsultations: WebConsultationItem[] = [
  {
    id: 'c-101',
    patientName: 'John Doe',
    studentId: 'STU-001',
    scheduledTime: 'Today 3:30 PM',
    duration: '45 min',
    status: 'Scheduled',
    avatarInitials: 'JD',
    patientEmail: 'student.test@mindpulse.edu',
  },
  {
    id: 'c-102',
    patientName: 'John Doe',
    studentId: 'STU-001',
    scheduledTime: 'April 06, 2026 10:00 AM',
    duration: '45 min',
    status: 'Completed',
    avatarInitials: 'JD',
    patientEmail: 'student.test@mindpulse.edu',
    notes: 'Discussed coping strategies for exam stress. Student reports better sleep quality after mindfulness sessions.',
  },
];

export const initialWebChatMessages: WebChatMessage[] = [
  {
    id: 'wm-1',
    sender: 'doctor',
    text: 'Hello John! I am Dr. Monroe. I reviewed your recent stress check score (68). How are you feeling today?',
    timestamp: '9:00 AM',
  },
  {
    id: 'wm-2',
    sender: 'patient',
    text: "Hi Dr. Monroe, I've been feeling quite stressed from work and class deadlines recently.",
    timestamp: '9:02 AM',
  },
  {
    id: 'wm-3',
    sender: 'doctor',
    text: "I see. Let's start with a guided breathing exercise during our scheduled consultation.",
    timestamp: '9:05 AM',
  },
];

export const fetchBookedSlotKeys = async (): Promise<Set<string>> => {
  const slotSet = new Set<string>(memoryBookedSlotKeys);

  try {
    if (supabase) {
      const { data, error } = await supabase.from('appointments').select('*');
      if (!error && data) {
        data.forEach((row: any) => {
          if (row.scheduled_for) {
            // Normalize "Today (Aug 31) at 3:30 PM" or "Today (Aug 31) 3:30 PM"
            const raw = String(row.scheduled_for).replace(' at ', ' ');
            const parts = raw.split(' ');
            if (parts.length >= 3) {
              const timeStr = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
              const dateStr = parts.slice(0, parts.length - 2).join(' ');
              slotSet.add(`${dateStr}_${timeStr}`);
            }
          }
        });
      }
    }
  } catch (e) {
    // Graceful fallback
  }

  return slotSet;
};

export const fetchWebConsultations = async (): Promise<WebConsultationItem[]> => {
  try {
    if (!supabase) return initialWebConsultations;

    const { data: appts, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && appts && appts.length > 0) {
      const fetched: WebConsultationItem[] = appts.map((row: any) => ({
        id: String(row.id),
        patientName: row.notes?.includes('Walk-in patient')
          ? row.notes.split(',')[0].replace('Walk-in patient ', '')
          : 'John Doe',
        studentId: 'STU-001',
        scheduledTime: row.scheduled_for || 'Today 3:30 PM',
        duration: '45 min',
        status: row.status === 'completed' ? 'Completed' : 'Scheduled',
        avatarInitials: row.notes?.includes('Walk-in patient')
          ? row.notes.split(',')[0].replace('Walk-in patient ', '').charAt(0).toUpperCase()
          : 'JD',
        patientEmail: row.notes?.includes('Email:')
          ? row.notes.split('Email:')[1].trim()
          : 'student.test@mindpulse.edu',
        notes: row.notes,
      }));

      return fetched;
    }
  } catch (e) {
    // Fallback
  }

  return initialWebConsultations;
};

export const saveDoctorScheduleAppointment = async (
  booking: ManualBookingData,
): Promise<WebConsultationItem> => {
  const slotKey = `${booking.selectedDate}_${booking.selectedTime}`;
  memoryBookedSlotKeys.add(slotKey);

  const initials = booking.patientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'P';

  const newConsultation: WebConsultationItem = {
    id: `c-manual-${Date.now()}`,
    patientName: booking.patientName,
    studentId: `STU-${Math.floor(100 + Math.random() * 900)}`,
    scheduledTime: `${booking.selectedDate} ${booking.selectedTime}`,
    duration: '45 min',
    status: 'Scheduled',
    avatarInitials: initials,
    patientEmail: booking.patientEmail,
    notes: `Walk-in patient ${booking.patientName}, Age ${booking.age}. Email: ${booking.patientEmail}. ${booking.notes}`,
  };

  try {
    if (supabase) {
      await supabase.from('appointments').insert({
        patient_id: 'a6a45e6c-63b3-44e6-895b-98d5dd7',
        doctor_id: '1b64dd8f-48f1-4298-ac06-61377665e',
        scheduled_for: `${booking.selectedDate} at ${booking.selectedTime}`,
        status: 'confirmed',
        notes: newConsultation.notes,
      });
    }
  } catch (e) {
    // Offline save fallback
  }

  return newConsultation;
};

export const fetchWebChatMessages = async (clinicianId: string = '1b64dd8f-48f1-4298-ac06-61377665e'): Promise<WebChatMessage[]> => {
  try {
    if (!supabase) return initialWebChatMessages;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: String(row.id),
        sender: row.sender as 'doctor' | 'patient',
        text: row.text,
        timestamp: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      }));
    }
  } catch (e) {
    // Fallback
  }

  return initialWebChatMessages;
};

export const sendWebChatMessage = async (
  clinicianId: string = '1b64dd8f-48f1-4298-ac06-61377665e',
  sender: 'doctor' | 'patient',
  text: string,
): Promise<WebChatMessage> => {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newMsg: WebChatMessage = {
    id: `wm-${Date.now()}`,
    sender,
    text,
    timestamp,
  };

  try {
    if (supabase) {
      await supabase.from('chat_messages').insert({
        clinician_id: '1b64dd8f-48f1-4298-ac06-61377665e',
        patient_id: 'a6a45e6c-63b3-44e6-895b-98d5dd7',
        sender,
        text,
      });
    }
  } catch (e) {
    // Offline fallback
  }

  return newMsg;
};
