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
 *
 * Requires EXPO_PUBLIC_DAILY_BASE_URL and EXPO_PUBLIC_DAILY_TOKEN in the app env.
 * No demo credentials are used — without configuration this throws instead of
 * persisting a fake session.
 */
export const createDailyVideoSession = async (
  doctorId: string,
  patientId: string,
): Promise<CallSessionPayload> => {
  const env = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;

  const baseUrl = env?.EXPO_PUBLIC_DAILY_BASE_URL;
  const token = env?.EXPO_PUBLIC_DAILY_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      'Video calling is not configured. Set EXPO_PUBLIC_DAILY_BASE_URL and EXPO_PUBLIC_DAILY_TOKEN.',
    );
  }

  const roomName = `mindpulse-${doctorId}-${patientId}-${Date.now()}`;
  const meetingUrl = `${baseUrl.replace(/\/$/, '')}/${roomName}`;

  const { data, error } = await supabase
    .from('video_sessions')
    .insert({
      room_name: roomName,
      meeting_url: meetingUrl,
      token,
      status: 'connecting',
      patient_id: patientId,
      doctor_id: doctorId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not start the video session.');
  }

  const row: any = data;
  return {
    roomName: row.room_name ?? roomName,
    meetingUrl: row.meeting_url ?? meetingUrl,
    token: row.token ?? token,
    status: (row.status ?? 'connecting') as CallStatus,
    doctorId: row.doctor_id ?? doctorId,
    patientId: row.patient_id ?? patientId,
  };
};

export const launchDoctorVideoCall = async (
  doctorId: string,
  patientId: string,
): Promise<CallSessionPayload> => {
  return createDailyVideoSession(doctorId, patientId);
};
