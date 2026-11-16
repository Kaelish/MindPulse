import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LandingPage } from './LandingPage';
import { MobileDownloadButton } from './MobileDownloadButton';
import { isDownloadUrlConfigured } from './landingConfig';

const HERO_DESCRIPTION =
  'MindPulse helps patients assess and monitor their emotional stress through AI-assisted '
  + 'assessments and personal stress history. Through our mobile application, patients can '
  + 'request teleconsultations, while doctors can review assessment results, respond to '
  + 'consultation requests, and provide professional guidance.';

describe('LandingPage', () => {
  test('renders the hero headline, description, and supporting text', () => {
    render(<LandingPage onLogIn={jest.fn()} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Understand Your Stress. Connect with Care.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(HERO_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText('Mobile application for patients and doctors.')).toBeInTheDocument();
  });

  test('shows the configured mobile download link', () => {
    render(<LandingPage onLogIn={jest.fn()} />);

    const link = screen.getByRole('link', { name: /download now/i });
    expect(link).toHaveAttribute(
      'href',
      'https://expo.dev/artifacts/eas/G4n8xJfG0gfSo40hK_-l4a301u8POTkPTMsuqx2ftn4.apk',
    );
    expect(screen.queryByText('Download link coming soon')).not.toBeInTheDocument();
  });

  test('Log In opens the web portal login, not the mobile download', () => {
    const onLogIn = jest.fn();
    render(<LandingPage onLogIn={onLogIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(onLogIn).toHaveBeenCalledTimes(1);
  });

  test('renders the About section and the three supported feature cards', () => {
    render(<LandingPage onLogIn={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Stress Assessment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Results and History' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Teleconsultation' })).toBeInTheDocument();
  });

  test('renders the built-in mobile onboarding preview by default', () => {
    render(<LandingPage onLogIn={jest.fn()} />);

    expect(screen.getByText('Multi-modal analysis,')).toBeInTheDocument();
    expect(screen.getByText('built for precision.')).toBeInTheDocument();
    expect(screen.getByText(/Fuses your survey/)).toBeInTheDocument();
    expect(screen.getByText('Emotion')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
    expect(screen.getByText('Survey')).toBeInTheDocument();
    expect(screen.getByText('Reaction')).toBeInTheDocument();
  });

  test('toggles the responsive navigation menu and closes it with Escape', () => {
    render(<LandingPage onLogIn={jest.fn()} />);

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Close menu');
    expect(document.getElementById('landing-nav-links')).toHaveClass('is-open');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('MobileDownloadButton', () => {
  test('renders a real link when a configured destination is supplied', () => {
    render(<MobileDownloadButton href="https://example.com/mindpulse.apk" />);

    const link = screen.getByRole('link', { name: /download now/i });
    expect(link).toHaveAttribute('href', 'https://example.com/mindpulse.apk');
    expect(screen.getByText('Mobile application for patients and doctors.')).toBeInTheDocument();
    expect(screen.queryByText('Download link coming soon')).not.toBeInTheDocument();
  });

  test('treats the bracketed placeholder as unconfigured', () => {
    render(<MobileDownloadButton href="[MINDPULSE_MOBILE_APP_DOWNLOAD_URL]" />);

    expect(screen.queryByRole('link', { name: /download now/i })).not.toBeInTheDocument();
    expect(screen.getByText('Download link coming soon')).toBeInTheDocument();
  });
});

describe('isDownloadUrlConfigured', () => {
  test('accepts http(s) links and local paths', () => {
    expect(isDownloadUrlConfigured('https://example.com/app')).toBe(true);
    expect(isDownloadUrlConfigured('http://example.com/app.apk')).toBe(true);
    expect(isDownloadUrlConfigured('/downloads/mindpulse.apk')).toBe(true);
  });

  test('rejects the placeholder, empty values, and unsupported schemes', () => {
    expect(isDownloadUrlConfigured('[MINDPULSE_MOBILE_APP_DOWNLOAD_URL]')).toBe(false);
    expect(isDownloadUrlConfigured('   ')).toBe(false);
    expect(isDownloadUrlConfigured('javascript:alert(1)')).toBe(false);
  });
});
