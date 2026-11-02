import React from 'react';
import { MOBILE_APP_SCREENSHOT_SRC } from './landingConfig';

type SplashIconName = 'emotion' | 'heart' | 'survey' | 'reaction';

const SPLASH_FEATURES: {
  id: SplashIconName;
  label: string;
  caption: string;
}[] = [
  { id: 'emotion', label: 'Emotion', caption: 'Facial cues analysis' },
  { id: 'heart', label: 'Heart Rate', caption: 'Biometric sensing' },
  { id: 'survey', label: 'Survey', caption: 'About your habits and mood' },
  { id: 'reaction', label: 'Reaction', caption: 'Response time test' },
];

const SplashIcon: React.FC<{ name: SplashIconName }> = ({ name }) => {
  const art: Record<SplashIconName, React.ReactNode> = {
    emotion: (
      <>
        <path d="M4.4 5.5h15.2a1.4 1.4 0 0 1 1.4 1.4v8.2a1.4 1.4 0 0 1-1.4 1.4h-8.9L6.2 20v-3.5H4.4A1.4 1.4 0 0 1 3 15.1V6.9a1.4 1.4 0 0 1 1.4-1.4Z" />
        <path d="M8.7 10.2h.01M15.3 10.2h.01" />
        <path d="M9.2 12.8c.7.9 1.6 1.3 2.8 1.3s2.1-.4 2.8-1.3" />
      </>
    ),
    heart: (
      <>
        <path d="M12 19.4s-6.7-4.1-6.7-8.4A3.7 3.7 0 0 1 12 8.5a3.7 3.7 0 0 1 6.7 2.5c0 4.3-6.7 8.4-6.7 8.4Z" />
        <path d="M6.2 12.1h2l1.2-2.3 1.8 4 1.3-2.5 1 .8h2.3" />
      </>
    ),
    survey: (
      <>
        <rect x="5" y="3.8" width="14" height="16.8" rx="2.4" />
        <path d="M9 3.8h6" />
        <path d="M8.6 9.2h6.8M8.6 12.6h3.9" />
        <path d="m8.8 16.4 1.2 1.2 2.5-2.5" />
      </>
    ),
    reaction: (
      <path d="M12.9 3.2 6 13h4.7l-1 7.8L17.5 11h-4.8Z" />
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
      {art[name]}
    </svg>
  );
};

const BRANCH_LEAVES: { x: number; y: number; rotate: number; scale: number }[] = [
  { x: 103, y: 254, rotate: 205, scale: 0.92 },
  { x: 104, y: 241, rotate: -25, scale: 0.9 },
  { x: 101, y: 221, rotate: 210, scale: 0.94 },
  { x: 102, y: 208, rotate: -30, scale: 0.92 },
  { x: 100, y: 188, rotate: 215, scale: 0.9 },
  { x: 101, y: 175, rotate: -35, scale: 0.88 },
  { x: 98, y: 155, rotate: 220, scale: 0.86 },
  { x: 98, y: 142, rotate: -40, scale: 0.84 },
  { x: 95, y: 122, rotate: 225, scale: 0.8 },
  { x: 94, y: 110, rotate: -45, scale: 0.78 },
  { x: 90, y: 90, rotate: 230, scale: 0.72 },
  { x: 88, y: 78, rotate: -50, scale: 0.68 },
];

const SplashBranch: React.FC = () => (
  <svg
    className="landing-splash-branch"
    viewBox="0 0 200 280"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M101 279c-4-54 3-103 9-148 5-37 2-76-12-108"
      fill="none"
      stroke="#78ad90"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
    {BRANCH_LEAVES.map((leaf, index) => (
      <path
        key={`${leaf.x}-${leaf.y}`}
        d="M0 0C10-8 24-9 33 0 23 9 9 8 0 0Z"
        fill={index % 3 === 0 ? '#8ec5a8' : index % 3 === 1 ? '#a5d2ba' : '#7fbb9d'}
        opacity="0.92"
        transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rotate}) scale(${leaf.scale})`}
      />
    ))}
  </svg>
);

/**
 * Realistic phone frame around the MindPulse patient app. When
 * MOBILE_APP_SCREENSHOT_SRC is configured the real screenshot is shown inside
 * the frame; otherwise a built-in onboarding screen keeps the hero complete.
 */
export const MobileAppMockup: React.FC = () => (
  <div
    className="landing-phone"
    role="img"
    aria-label="MindPulse mobile app onboarding screen introducing multi-modal stress analysis"
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
            alt="MindPulse mobile app onboarding screen introducing multi-modal stress analysis"
          />
        ) : (
          <div className="landing-splash" aria-hidden="true">
            <div className="landing-splash-status">
              <span>9:41</span>
              <span className="landing-splash-status-icons">
                <i />
                <i />
                <i />
              </span>
            </div>

            <span className="landing-splash-skip">Skip</span>

            <div className="landing-splash-stage">
              <SplashBranch />

              <div className="landing-splash-grid">
                {SPLASH_FEATURES.map((feature) => (
                  <div
                    className={`landing-splash-card is-${feature.id}`}
                    key={feature.id}
                  >
                    <span className="landing-splash-icon">
                      <SplashIcon name={feature.id} />
                    </span>
                    <strong>{feature.label}</strong>
                    <small>{feature.caption}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-splash-copy">
              <h3>
                Multi-modal analysis,
                <br />
                <span>built for precision.</span>
              </h3>
              <p>
                Fuses your survey, heart rate, facial cues, and reaction time into one
                accurate stress score.
              </p>
            </div>

            <div className="landing-splash-dots">
              <span />
              <span className="is-active" />
              <span />
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
