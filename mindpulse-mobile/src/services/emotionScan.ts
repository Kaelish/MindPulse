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

interface EmotionHealthResponse {
  warmup?: string;
}

export type EmotionServiceStatus = 'ready' | 'loading' | 'failed' | 'unreachable';

/** Backend classes (Happy/Neutral/Sad) -> app expression vocabulary. */
const BACKEND_LABEL_TO_EXPRESSION: Record<string, FaceEmotion> = {
  happy: 'happy',
  neutral: 'neutral',
  sad: 'sad',
};

// Render's free service can sleep. Allow enough time for the cold start.
const REQUEST_TIMEOUT_MS = 90000;
// A sleeping instance can reset the first connection. Retry once when the
// failure happens immediately, but do not make the user wait twice as long
// after a genuine timeout.
const RETRY_DELAY_MS = 1500;
const RETRY_WINDOW_MS = 15000;
const HEALTH_TIMEOUT_MS = 10000;
const WARMUP_POLL_INTERVAL_MS = 3000;
const WARMUP_MAX_POLLS = 20;
let warmupPromise: Promise<boolean> | null = null;

const getHealthStatus = async (): Promise<EmotionServiceStatus> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/health/`, {
      signal: controller.signal,
    });
    if (!response.ok) return 'unreachable';
    const payload = (await response.json()) as EmotionHealthResponse;
    if (payload.warmup === 'ok') return 'ready';
    if (payload.warmup === 'failed') return 'failed';
    return 'loading';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Wake Render and wait for the model warm-up without making login depend on it.
 * A failed warm-up is returned to the caller but never thrown, because capture
 * can still provide the backend's more specific error.
 */
export const warmEmotionService = async (): Promise<boolean> => {
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    for (let poll = 0; poll < WARMUP_MAX_POLLS; poll += 1) {
      const status = await getHealthStatus();
      if (status === 'ready') return true;
      if (status === 'failed') return false;
      if (poll < WARMUP_MAX_POLLS - 1) {
        await new Promise((resolve) => setTimeout(resolve, WARMUP_POLL_INTERVAL_MS));
      }
    }
    return false;
  })();

  try {
    return await warmupPromise;
  } finally {
    warmupPromise = null;
  }
};

const postFrame = async (url: string, body: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const isAbortError = (err: unknown): boolean =>
  err instanceof Error && err.name === 'AbortError';

const timeoutError = (): Error =>
  new Error(
    'The emotion service took too long to respond. The server may be waking up; please try again.',
  );

const unreachableError = (): Error =>
  new Error(
    'Could not reach the emotion service. Please check your internet connection and try again.',
  );

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
  const body = JSON.stringify({
    image: base64Image,
    ...(sadBias != null ? { sad_bias: sadBias } : {}),
  });

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await postFrame(url, body);
  } catch (err) {
    if (isAbortError(err)) throw timeoutError();
    if (Date.now() - startedAt > RETRY_WINDOW_MS) throw unreachableError();

    // The service may have reset an in-flight connection while waking up.
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      response = await postFrame(url, body);
    } catch (retryErr) {
      throw isAbortError(retryErr) ? timeoutError() : unreachableError();
    }
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
