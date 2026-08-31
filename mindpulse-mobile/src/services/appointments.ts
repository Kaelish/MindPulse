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
  selectedDate: string; // e.g. "Today (Aug 31)" or "Sep 1, 2026"
  selectedTime: string; // e.g. "3:30 PM"
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export const initialClinicians: TelehealthClinician[] = [
  {
    id: '1b64dd8f-48f1-4298-ac06-61377665e',
    name: 'Dr. Monroe Leclair',
    specialty: 'Clinical Psychologist',
    avatar: '👩‍⚕️',
    status: 'Available',
    bio: 'Specializing in cognitive behavioral therapy for student stress, burnout, and anxiety disorders.',
    tags: ['Stress', 'Anxiety', 'Mindfulness'],
    email: 'doctor.test@mindpulse.org',
  },
];

export const generateRealLifeDates = (): { label: string; dateStr: string }[] => {
  const dates: { label: string; dateStr: string }[] = [];
  const today = new Date(); // 2026-08-31

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : daysOfWeek[d.getDay()];
    const monthName = months[d.getMonth()];
    const dayNum = d.getDate();

    dates.push({
      label: dayName,
      dateStr: `${monthName} ${dayNum}, ${d.getFullYear()}`,
    });
  }

  return dates;
};

export const initialChatMessages: ChatMessage[] = [
  {
    id: 'm-1',
    sender: 'doctor',
    text: 'Hello John! I am Dr. Monroe. I reviewed your recent stress check score (68). How are you feeling today?',
    timestamp: '9:00 AM',
    status: 'read',
  },
  {
    id: 'm-2',
    sender: 'patient',
    text: "Hi Dr. Monroe, I've been feeling quite stressed from work and class deadlines recently.",
    timestamp: '9:02 AM',
    status: 'read',
  },
  {
    id: 'm-3',
    sender: 'doctor',
    text: "I see. Let's start with a guided breathing exercise during our scheduled consultation.",
    timestamp: '9:05 AM',
    status: 'read',
  },
];

export const saveBookedAppointment = async (
  appointment: Omit<BookedAppointment, 'id' | 'createdAt'>,
): Promise<BookedAppointment> => {
  const newAppt: BookedAppointment = {
    id: `appt-${Date.now()}`,
    ...appointment,
    createdAt: new Date().toISOString(),
  };

  try {
    await supabase.from('appointments').insert({
      patient_id: 'a6a45e6c-63b3-44e6-895b-98d5dd7',
      doctor_id: '1b64dd8f-48f1-4298-ac06-61377665e',
      scheduled_for: `${appointment.selectedDate} at ${appointment.selectedTime}`,
      status: 'confirmed',
      notes: `Booked session with ${appointment.clinicianName}`,
    });
  } catch (e) {
    // Fallback for offline mode
  }

  return newAppt;
};

export const fetchChatMessages = async (clinicianId: string = '1b64dd8f-48f1-4298-ac06-61377665e'): Promise<ChatMessage[]> => {
  try {
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
        status: 'read',
      }));
    }
  } catch (e) {
    // Fallback
  }

  return initialChatMessages;
};

export const sendChatMessage = async (
  clinicianId: string = '1b64dd8f-48f1-4298-ac06-61377665e',
  sender: 'doctor' | 'patient',
  text: string,
): Promise<ChatMessage> => {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    sender,
    text,
    timestamp,
    status: 'delivered',
  };

  try {
    await supabase.from('chat_messages').insert({
      clinician_id: '1b64dd8f-48f1-4298-ac06-61377665e',
      patient_id: 'a6a45e6c-63b3-44e6-895b-98d5dd7',
      sender,
      text,
    });
  } catch (e) {
    // Graceful offline save
  }

  return newMsg;
};

export const generateDoctorReplyText = (patientText: string, clinicianName: string): string => {
  const lower = patientText.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return `Hello John! This is Dr. Monroe. How can I assist you with your mental health wellness today?`;
  }
  if (lower.includes('stress') || lower.includes('anxious') || lower.includes('anxiety')) {
    return `I understand. High stress levels can affect sleep and heart rate. Let's try 4-7-8 breathing exercises and discuss coping strategies.`;
  }
  if (lower.includes('appointment') || lower.includes('time') || lower.includes('schedule')) {
    return `Your appointment is confirmed on my calendar. I have reviewed your biometrics and look forward to our session!`;
  }
  if (lower.includes('sleep') || lower.includes('tired') || lower.includes('insomnia')) {
    return `Sleep quality directly impacts stress resilience. I recommend limiting screen time 1 hour before bed and keeping a consistent sleep schedule.`;
  }
  if (lower.includes('thank') || lower.includes('thanks') || lower.includes('ok')) {
    return `You're very welcome! Feel free to reach out anytime before our scheduled call.`;
  }

  return `Thank you for sharing that with me. I've logged your notes in your MindPulse care chart. See you at our video consultation!`;
};
