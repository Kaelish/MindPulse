import React from 'react';
import { MOBILE_APP_DOWNLOAD_URL, isDownloadUrlConfigured } from './landingConfig';

const DownloadIcon: React.FC = () => (
  <svg
    className="landing-download-icon"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 3v11" />
    <path d="m7.5 10 4.5 4.5L16.5 10" />
    <path d="M4 17.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
  </svg>
);

interface MobileDownloadButtonProps {
  /** Defaults to the configured MOBILE_APP_DOWNLOAD_URL constant. */
  href?: string;
}

/**
 * Primary hero action. It only becomes a real link when a mobile application
 * destination is configured; otherwise it renders the same button in a
 * disabled state and never navigates to the placeholder.
 */
export const MobileDownloadButton: React.FC<MobileDownloadButtonProps> = ({
  href = MOBILE_APP_DOWNLOAD_URL,
}) => {
  const configured = isDownloadUrlConfigured(href);

  return (
    <div className="landing-download">
      {configured ? (
        <a className="landing-download-btn" href={href} rel="noopener noreferrer">
          <DownloadIcon />
          <span>Download Now</span>
        </a>
      ) : (
        <button type="button" className="landing-download-btn is-disabled" disabled>
          <DownloadIcon />
          <span>Download Now</span>
        </button>
      )}

      <p className="landing-download-note">Mobile application for patients and doctors.</p>

      {!configured && (
        <p className="landing-download-coming" role="status">
          Download link coming soon
        </p>
      )}
    </div>
  );
};
