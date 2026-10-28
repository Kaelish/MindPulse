/**
 * emotionScan
 *
 * Sends a captured camera frame to the MindPulse emotion service — the Django
 * backend that runs the capstone hybrid model (pixel CNN + 1,434 MediaPipe face
 * landmarks -> scaler -> multinomial logistic regression).
 *
 * Requires EXPO_PUBLIC_MINDPULSE_API_URL in the app env. Without configuration
 * this throws instead of returning a fake result, matching the pattern used by
 * services/video.ts.
 *
 * The backend returns one of three classes — Happy / Neutral / Sad. Those map
 * 1:1 onto the expression vocabulary used by the face-scan result screen.
 */

export type FaceEmotion = 'happy' | 'neutral' | 'sad';

export interface FaceScanResult {
  /** Expression mapped to the app vocabulary used by the result screen. */
  expression: FaceEmotion;
  /** Confidence for the winning class, 0..1. */
  confidence: number;
  /** Raw class label returned by the backend (e.g. "Sad"). */
  label: string;
  /** Full class probability distribution keyed by label. */
  probabilities: Record<string, number>;
  /** Second-most-likely class, when the backend provides it. */
  runnerUp: { label: string; confidence: number } | null;
}

interface EmotionApiResponse {
  label?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  runner_up?: { label: string; confidence: number } | null;
  detail?: string;
}

/** Backend classes (Happy/Neutral/Sad) -> app expression vocabulary. */
const BACKEND_LABEL_TO_EXPRESSION: Record<string, FaceEmotion> = {
  happy: 'happy',
  neutral: 'neutral',
  sad: 'sad',
};

const REQUEST_TIMEOUT_MS = 20000;

const getApiBaseUrl = (): string => {
  // Must be a literal `process.env.EXPO_PUBLIC_*` member access: babel-preset-expo
  // only rewrites that exact shape (dev -> expo/virtual/env, prod -> inlined value).
  // Reading it through `globalThis.process` hides it from that transform, so the
  // .env value never reaches the app and capture always reports "not configured".
  const baseUrl = (process.env.EXPO_PUBLIC_MINDPULSE_API_URL || 'https://mindpulse-backend-dgz0.onrender.com')?.trim();
  if (!baseUrl) {
    throw new Error(
      'Face scan is not configured. Set EXPO_PUBLIC_MINDPULSE_API_URL to the MindPulse backend URL.',
    );
  }
  return baseUrl.replace(/\/$/, '');
};

/**
 * Analyse a captured face image on the backend.
 *
 * @param base64Image Raw base64 JPEG or a full data URL ("data:image/jpeg;base64,...").
 * @param sadBias Optional Sad-class bias (the official model uses 1.5).
 */
export const analyzeFaceImage = async (
  base64Image: string,
  sadBias?: number,
): Promise<FaceScanResult> => {
  const url = `${getApiBaseUrl()}/api/predict-emotion/`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        ...(sadBias != null ? { sad_bias: sadBias } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new Error(
      aborted
        ? 'The emotion analysis timed out. Check your connection and try again.'
        : 'Could not reach the emotion service. Check EXPO_PUBLIC_MINDPULSE_API_URL and your network.',
    );
  } finally {
    clearTimeout(timeout);
  }

  let payload: EmotionApiResponse | null = null;
  try {
    payload = (await response.json()) as EmotionApiResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.detail || `Face scan failed (HTTP ${response.status}).`);
  }
  if (!payload?.label) {
    throw new Error('The emotion service returned an unexpected response.');
  }

  const probabilities = payload.probabilities ?? {};
  const rawConfidence =
    typeof payload.confidence === 'number' ? payload.confidence : probabilities[payload.label] ?? 0;

  return {
    expression: BACKEND_LABEL_TO_EXPRESSION[payload.label.toLowerCase()] ?? 'neutral',
    confidence: Math.min(1, Math.max(0, rawConfidence)),
    label: payload.label,
    probabilities,
    runnerUp: payload.runner_up ?? null,
  };
};
