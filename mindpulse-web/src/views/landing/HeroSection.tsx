import React from 'react';
import { DoctorPatientIllustration } from './DoctorPatientIllustration';
import { MobileAppMockup } from './MobileAppMockup';
import { MobileDownloadButton } from './MobileDownloadButton';

export const HeroSection: React.FC = () => (
  <section id="home" className="landing-hero" aria-labelledby="landing-hero-title">
    <div className="landing-container landing-hero-inner">
      <div className="landing-hero-visual">
        <span className="landing-hero-glow" aria-hidden="true" />
        <span className="landing-hero-ring" aria-hidden="true" />
        <DoctorPatientIllustration />
        <MobileAppMockup />

        <div className="landing-float-card is-score" aria-hidden="true">
          <span className="landing-float-dot is-mint" />
          <span>
            <strong>Stress level</strong>
            <small>32 · Low</small>
          </span>
        </div>

        <div className="landing-float-card is-session" aria-hidden="true">
          <span className="landing-float-dot is-blue" />
          <span>
            <strong>Teleconsultation</strong>
            <small>Today · 3:30 PM</small>
          </span>
        </div>
      </div>

      <div className="landing-hero-copy">
        <p className="landing-eyebrow">AI-based emotional stress detection</p>
        <h1 id="landing-hero-title" className="landing-hero-title">
          Understand Your Stress. <span>Connect with Care.</span>
        </h1>
        <p className="landing-lede">
          MindPulse helps patients assess and monitor their emotional stress through AI-assisted
          assessments and personal stress history. Through our mobile application, patients can
          request teleconsultations, while doctors can review assessment results, respond to
          consultation requests, and provide professional guidance.
        </p>

        <MobileDownloadButton />
      </div>
    </div>
  </section>
);
