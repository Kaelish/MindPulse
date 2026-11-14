import React, { useEffect, useState } from 'react';
import { prefersReducedMotion } from './LandingNavbar';

export const BackToTopButton: React.FC = () => {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 300;
      setShowBackToTop(scrolled);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      top: 0,
    });
  };

  return (
    <button
      type="button"
      className={`landing-back-to-top${showBackToTop ? '' : ' is-hidden'}`}
      aria-label="Back to top"
      onClick={scrollToTop}
      title="Back to top"
    >
      <svg className="arrow-up" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4L4.5 11.5L6.91421 13.9142L12 8.82843L17.0858 13.9142L19.5 11.5L12 4Z" />
      </svg>
    </button>
  );
};
