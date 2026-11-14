import React, { useEffect, useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo';

interface LandingNavbarProps {
  /** Opens the existing web portal login screen. */
  onLogIn: () => void;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export { prefersReducedMotion };

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onLogIn }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const scrollToSection = (id: 'home' | 'about') => {
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <header className="landing-nav">
      <div className="landing-container landing-nav-inner">
        <a
          className="landing-brand"
          href="#home"
          onClick={(event) => {
            event.preventDefault();
            scrollToSection('home');
          }}
        >
          <span className="landing-brand-mark">
            <BrandLogo className="landing-brand-logo" />
          </span>
          <span className="landing-brand-name">MindPulse</span>
        </a>

        <button
          type="button"
          className={`landing-nav-toggle${menuOpen ? ' is-open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="landing-nav-links"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav
          id="landing-nav-links"
          className={`landing-nav-links${menuOpen ? ' is-open' : ''}`}
          aria-label="Main navigation"
        >
          <a
            href="#home"
            onClick={(event) => {
              event.preventDefault();
              scrollToSection('home');
            }}
          >
            Home
          </a>
          <a
            href="#about"
            onClick={(event) => {
              event.preventDefault();
              scrollToSection('about');
            }}
          >
            About
          </a>
          <button type="button" className="landing-nav-login" onClick={onLogIn}>
            Log In
          </button>
        </nav>
      </div>
    </header>
  );
};
