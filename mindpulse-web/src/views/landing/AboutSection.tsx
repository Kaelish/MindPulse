import React from 'react';

type FeatureIconName = 'assessment' | 'history' | 'consultation';

const FeatureIcon: React.FC<{ name: FeatureIconName }> = ({ name }) => {
  const art: Record<FeatureIconName, React.ReactNode> = {
    assessment: (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="3" />
        <path d="M8 8h8M8 12h5" />
        <path d="m8 16 1.8 1.8L13 14.5" />
      </>
    ),
    history: (
      <>
        <path d="M4 19V9M9.5 19V5M15 19v-6M20.5 19V8" />
      </>
    ),
    consultation: (
      <>
        <rect x="3" y="6" width="12.5" height="11.5" rx="3" />
        <path d="m15.5 10.5 5-3v9l-5-3" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {art[name]}
    </svg>
  );
};

const FEATURES: {
  id: FeatureIconName;
  title: string;
  description: string;
}[] = [
  {
    id: 'assessment',
    title: 'Stress Assessment',
    description:
      'Complete assessments using questionnaires, facial emotion analysis, and other supported assessment inputs.',
  },
  {
    id: 'history',
    title: 'Results and History',
    description: 'View assessment results and track stress history.',
  },
  {
    id: 'consultation',
    title: 'Teleconsultation',
    description:
      'Patients request consultations, and doctors review assessment information and provide professional guidance.',
  },
];

export const AboutSection: React.FC = () => (
  <section id="about" className="landing-about" aria-labelledby="landing-about-title">
    <div className="landing-container">
      <div className="landing-section-head">
        <p className="landing-eyebrow">About MindPulse</p>
        <h2 id="landing-about-title">Support for stress assessment and care, in one place.</h2>
        <p>
          MindPulse supports emotional stress assessment, monitoring, and patient–doctor
          consultation. Patients can complete supported assessments, review their results and
          stress history, and request a teleconsultation when they need professional guidance.
        </p>
      </div>

      <div className="landing-feature-grid">
        {FEATURES.map((feature) => (
          <article className="landing-feature-card" key={feature.id}>
            <span className={`landing-feature-icon is-${feature.id}`}>
              <FeatureIcon name={feature.id} />
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
