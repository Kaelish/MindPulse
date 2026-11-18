import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  MOBILE_APP_DOWNLOAD_URL,
  isDownloadUrlConfigured,
} from './landingConfig';

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
  const [qrCode, setQrCode] = useState('');
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    if (!configured) {
      setQrCode('');
      setQrError('');
      return;
    }

    let active = true;
    setQrError('');
    void QRCode.toDataURL(href, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 180,
    })
      .then((dataUrl) => {
        if (active) setQrCode(dataUrl);
      })
      .catch((error: unknown) => {
        if (active) {
          setQrError(error instanceof Error ? error.message : 'The download QR code could not be generated.');
        }
      });

    return () => {
      active = false;
    };
  }, [configured, href]);

  return (
    <div className="landing-download">
      <div className="landing-download-actions">
        <div>
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
        </div>

        {configured && qrCode && (
          <div className="landing-download-qr">
            <img src={qrCode} alt="Scan to download the MindPulse mobile app" />
            <span>Scan to download</span>
          </div>
        )}
      </div>

      {!configured && (
        <p className="landing-download-coming" role="status">
          Download link coming soon
        </p>
      )}
      {configured && qrError && (
        <p className="landing-download-coming" role="alert">
          {qrError}
        </p>
      )}
    </div>
  );
};
