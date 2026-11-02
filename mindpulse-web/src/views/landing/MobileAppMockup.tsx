import React from 'react';
import { MOBILE_APP_SCREENSHOT_SRC } from './landingConfig';

type AppIconName = 'home' | 'history' | 'consult' | 'profile' | 'bell';

const AppIcon: React.FC<{ name: AppIconName }> = ({ name }) => {
  const paths: Record<AppIconName, React.ReactNode> = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V9.5" />
      </>
    ),
    history: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    consult: (
      <>
        <rect x="3" y="6.5" width="12" height="11" rx="2.5" />
        <path d="m15 10.5 5-3v9l-5-3" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </>
    ),
    bell: (
      <>
        <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z" />
        <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
};

/**
 * Realistic phone frame around the MindPulse patient app. When
 * MOBILE_APP_SCREENSHOT_SRC is configured the real screenshot is shown inside
 * the frame; otherwise a built-in preview keeps the hero complete.
 */
export const MobileAppMockup: React.FC = () => (
  <div
    className="landing-phone"
    role="img"
    aria-label="MindPulse mobile app preview showing a low stress score and an upcoming teleconsultation"
  >
    <div className="landing-phone-frame">
      <span className="landing-phone-notch" aria-hidden="true" />
      <span className="landing-phone-button is-volume" aria-hidden="true" />
      <span className="landing-phone-button is-power" aria-hidden="true" />

      <div className="landing-phone-screen">
        {MOBILE_APP_SCREENSHOT_SRC ? (
          <img
            className="landing-phone-shot"
            src={MOBILE_APP_SCREENSHOT_SRC}
            alt="MindPulse mobile app dashboard with stress assessment results"
          />
        ) : (
          <div className="landing-app" aria-hidden="true">
            <div className="landing-app-status">
              <span>9:41</span>
              <span className="landing-app-status-icons">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="landing-app-header">
              <span className="landing-app-brand">
                <span className="landing-app-logo">M</span>
                MindPulse
              </span>
              <span className="landing-app-bell">
                <AppIcon name="bell" />
              </span>
            </div>

            <div className="landing-app-greeting">
              <p>Good morning,</p>
              <h3>Zamantha</h3>
            </div>

            <div className="landing-app-score">
              <div className="landing-app-score-top">
                <span>Current stress level</span>
                <span className="landing-app-badge">Low</span>
              </div>
              <div className="landing-app-score-value">
                <strong>32</strong>
                <span>/100</span>
              </div>
              <div className="landing-app-meter">
                <span style={{ width: '32%' }} />
              </div>
              <p>Based on your latest assessment</p>
            </div>

            <div className="landing-app-moods">
              <p>How are you feeling?</p>
              <div className="landing-app-mood-row">
                <span className="landing-app-mood is-calm">Calm</span>
                <span className="landing-app-mood is-anxious">Anxious</span>
                <span className="landing-app-mood is-tired">Tired</span>
              </div>
            </div>

            <div className="landing-app-next">
              <span className="landing-app-next-avatar">ZA</span>
              <span className="landing-app-next-copy">
                <strong>Dr. Zamantha Abelino</strong>
                <span>Today · 3:30 PM</span>
              </span>
              <span className="landing-app-join">Join</span>
            </div>

            <div className="landing-app-tip">
              <span className="landing-app-tip-dot">M</span>
              <span className="landing-app-tip-copy">
                <strong>Daily tip</strong>
                <span>Take a short breathing break</span>
              </span>
              <span className="landing-app-tip-arrow">›</span>
            </div>

            <div className="landing-app-nav">
              <span className="is-active">
                <AppIcon name="home" />
                Home
              </span>
              <span>
                <AppIcon name="history" />
                History
              </span>
              <span>
                <AppIcon name="consult" />
                Consult
              </span>
              <span>
                <AppIcon name="profile" />
                Profile
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
