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
}

export interface WebChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
}

export const initialWebConsultations: WebConsultationItem[] = [
  {
    id: 'c-101',
    patientName: 'Liberty Fierro',
    studentId: 'STU-001',
    scheduledTime: 'April 08, 2026 2:00 PM',
    duration: '45 min',
    status: 'Scheduled',
    avatarInitials: 'LF',
  },
  {
    id: 'c-102',
    patientName: 'John Doe',
    studentId: 'STU-102',
    scheduledTime: 'Today 3:30 PM',
    duration: '60 min',
    status: 'Scheduled',
    avatarInitials: 'JD',
  },
  {
    id: 'c-103',
    patientName: 'Zamantha Abvelino',
    studentId: 'STU-003',
    scheduledTime: 'April 08, 2026 3:30 PM',
    duration: '60 min',
    status: 'Scheduled',
    avatarInitials: 'ZA',
  },
  {
    id: 'c-104',
    patientName: 'Trina Muego',
    studentId: 'STU-004',
    scheduledTime: 'April 06, 2026 10:00 AM',
    duration: '45 min',
    status: 'Completed',
    avatarInitials: 'TM',
    notes: 'Discussed coping strategies. Student reports better sleep quality. Schedule follow-up in 2 weeks.',
  },
];

export const initialWebChatMessages: WebChatMessage[] = [
  {
    id: 'wm-1',
    sender: 'doctor',
    text: 'Hello John! I reviewed your recent stress check score (68). How are you feeling today?',
    timestamp: '9:00 AM',
  },
  {
    id: 'wm-2',
    sender: 'patient',
    text: "Hi Dr. Monroe, I've been feeling quite stressed from work deadlines recently.",
    timestamp: '9:02 AM',
  },
  {
    id: 'wm-3',
    sender: 'doctor',
    text: "I see. Let's start with a guided breathing exercise during our session.",
    timestamp: '9:05 AM',
  },
];

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
        patientName: row.notes?.includes('session with') ? row.notes.replace('Booked session with ', '') : 'John Doe',
        studentId: 'STU-102',
        scheduledTime: row.scheduled_for || 'Today 3:30 PM',
        duration: '45 min',
        status: row.status === 'completed' ? 'Completed' : 'Scheduled',
        avatarInitials: 'JD',
      }));

      // Merge with default list
      return [...fetched, ...initialWebConsultations.filter(c => c.id !== 'c-102')];
    }
  } catch (e) {
    // Fallback
  }

  return initialWebConsultations;
};

export const fetchWebChatMessages = async (clinicianId: string = 'c-1'): Promise<WebChatMessage[]> => {
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
  clinicianId: string = 'c-1',
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
        clinician_id: clinicianId,
        sender,
        text,
      });
    }
  } catch (e) {
    // Offline fallback
  }

  return newMsg;
};
