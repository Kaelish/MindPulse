import React, { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './LandingNavbar';

const SHOW_THRESHOLD = 200;

export const BackToTopButton: React.FC = () => {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [justShown, setJustShown] = useState(false);
  const previouslyShown = useRef(false);
  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      const scrolled = window.scrollY > SHOW_THRESHOLD;
      setShowBackToTop(scrolled);
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (showBackToTop && !previouslyShown.current) {
      setJustShown(true);
      const timer = setTimeout(() => setJustShown(false), 900);
      return () => clearTimeout(timer);
    }
    previouslyShown.current = showBackToTop;
  }, [showBackToTop]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      top: 0,
    });
  }, []);

  return (
    <button
      type="button"
      className={`landing-back-to-top${showBackToTop ? '' : ' is-hidden'}${justShown ? ' is-just-shown' : ''}`}
      aria-label="Back to top"
      onClick={scrollToTop}
      title="Back to top"
    >
      <span className="btt-label">Top</span>
      <svg className="arrow-up" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4L4.5 11.5L6.91421 13.9142L12 8.82843L17.0858 13.9142L19.5 11.5L12 4Z" />
      </svg>
    </button>
  );
};
