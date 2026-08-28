export type CallStatus = 'connecting' | 'live' | 'ended';

import { supabase } from '../supabase/client';

export interface CallSessionPayload {
  roomName: string;
  meetingUrl: string;
  token: string;
  status: CallStatus;
  doctorId: string;
  patientId: string;
}

/**
 * Chosen real-time video provider: Daily.co
 *
 * Daily.co is a good fit for peer-to-peer healthcare consultations because it is
 * lightweight, browser/mobile friendly, and can support one-to-one patient/doctor
 * calls with minimal complexity for an MVP.
 */
export const createDailyVideoSession = async (
  doctorId: string,
  patientId: string,
): Promise<CallSessionPayload> => {
  const roomName = `mindpulse-${doctorId}-${patientId}-${Date.now()}`;

  const env = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;

  const fallbackUrl = `${env?.EXPO_PUBLIC_DAILY_BASE_URL ?? 'https://mindpulse.daily.co'}/${roomName}`;
  const fallbackToken = env?.EXPO_PUBLIC_DAILY_TOKEN ?? 'demo-token';

  const payload: CallSessionPayload = {
    roomName,
    meetingUrl: fallbackUrl,
    token: fallbackToken,
    status: 'connecting',
    doctorId,
    patientId,
  };

  try {
    const { data, error } = await supabase
      .from('video_sessions')
      .insert({
        room_name: payload.roomName,
        meeting_url: payload.meetingUrl,
        token: payload.token,
        status: payload.status,
        patient_id: payload.patientId,
        doctor_id: payload.doctorId,
      })
      .select()
      .single();

    if (!error && data) {
      return {
        roomName: data.room_name ?? payload.roomName,
        meetingUrl: data.meeting_url ?? payload.meetingUrl,
        token: data.token ?? payload.token,
        status: (data.status ?? payload.status) as CallStatus,
        doctorId: data.doctor_id ?? payload.doctorId,
        patientId: data.patient_id ?? payload.patientId,
      };
    }
  } catch {
    // Graceful fallback for local previews when Supabase tables are not ready.
  }

  return payload;
};

export const launchDoctorVideoCall = async (
  doctorId: string,
  patientId: string,
): Promise<CallSessionPayload> => {
  return createDailyVideoSession(doctorId, patientId);
};
