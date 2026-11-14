import React from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import { AboutSection } from './AboutSection';
import { FaqSection } from './FaqSection';
import { HeroSection } from './HeroSection';
import { LandingNavbar } from './LandingNavbar';
import { BackToTopButton } from './BackToTopButton';
import './LandingPage.css';

interface LandingPageProps {
  /** Opens the existing web portal login screen (never the mobile download). */
  onLogIn: () => void;
}

/**
 * Public landing page shown at `/` for visitors without a staff session.
 * The Admin and Doctor portals keep their existing role-based routing — this
 * page only replaces the unauthenticated screen.
 */
export const LandingPage: React.FC<LandingPageProps> = ({ onLogIn }) => {
  const year = new Date().getFullYear();

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#main-content">
        Skip to content
      </a>

      <LandingNavbar onLogIn={onLogIn} />
      <BackToTopButton />

      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <AboutSection />
        <FaqSection />
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <span className="landing-footer-brand">
            <span className="landing-brand-mark is-small">
              <BrandLogo className="landing-brand-logo" />
            </span>
            <span>MindPulse</span>
          </span>
          <p>
            © {year} MindPulse · AI-based emotional stress detection for patients and doctors.
          </p>
        </div>
      </footer>
    </div>
  );
};
