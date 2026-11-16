/**
 * Public landing page configuration.
 *
 * The current value is the direct EAS APK artifact URL, not the EAS build
 * dashboard URL. You can replace it with a permanent release URL later, or set
 * REACT_APP_MOBILE_APP_DOWNLOAD_URL in mindpulse-web/.env.local; the environment
 * value wins over the placeholder below.
 */
const DEFAULT_MOBILE_APP_DOWNLOAD_URL =
  'https://expo.dev/artifacts/eas/G4n8xJfG0gfSo40hK_-l4a301u8POTkPTMsuqx2ftn4.apk';

const configuredDownloadUrl = (process.env.REACT_APP_MOBILE_APP_DOWNLOAD_URL ?? '').trim();

export const MOBILE_APP_DOWNLOAD_URL =
  configuredDownloadUrl
  && !configuredDownloadUrl.includes('[')
  && !configuredDownloadUrl.includes(']')
  ? configuredDownloadUrl
  : DEFAULT_MOBILE_APP_DOWNLOAD_URL;

/**
 * Optional real screenshot of the MindPulse mobile app (for example
 * `/assets/mindpulse-app.png` from the public folder). When this is empty the
 * phone mockup renders a built-in preview of the patient app instead.
 */
export const MOBILE_APP_SCREENSHOT_SRC =
  (process.env.REACT_APP_MOBILE_APP_SCREENSHOT_SRC ?? '').trim();

/**
 * A URL counts as configured only when it is a real http(s) link or a local
 * path. Placeholders such as [MINDPULSE_MOBILE_APP_DOWNLOAD_URL] are rejected so
 * the landing page can show the disabled "coming soon" state instead.
 */
export const isDownloadUrlConfigured = (url: string = MOBILE_APP_DOWNLOAD_URL): boolean => {
  const value = url.trim();
  if (!value) return false;
  if (value.includes('[') || value.includes(']')) return false;
  return /^https?:\/\//i.test(value) || value.startsWith('/');
};
