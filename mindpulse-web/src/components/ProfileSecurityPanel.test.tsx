import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProfileSecurityPanel } from './ProfileSecurityPanel';
import { activeVerificationMethod, disableVerification, readVerificationProfile } from '../services/signInVerification';

const session = {
  id: 'session-1',
  deviceName: 'Laptop / desktop (Windows)',
  browser: 'Google Chrome',
  operatingSystem: 'Windows',
  ipAddress: 'Not shared by browsers',
  location: 'Asia/Manila (browser time zone)',
  roleLabel: 'Admin web',
  signedInAt: '2026-10-24T01:00:00.000Z',
  lastActiveAt: '2026-10-24T02:00:00.000Z',
  isCurrent: true,
};

jest.mock('../services/profileSessions', () => ({
  subscribeProfileSessions: (listener: (next: unknown) => void) => {
    listener({ sessions: [session], status: 'live', message: '', notice: '' });
    return () => undefined;
  },
  revokeProfileSession: jest.fn(),
  revokeOtherProfileSessions: jest.fn(),
  signOutCurrentDevice: jest.fn(),
}));

jest.mock('../services/signInVerification', () => ({
  activeVerificationMethod: jest.fn().mockResolvedValue(null),
  challengeFactor: jest.fn(),
  disableVerification: jest.fn(),
  destinationError: jest.fn(() => ''),
  enrollTotp: jest.fn(),
  markContactMethodVerified: jest.fn(),
  markFactorMethodVerified: jest.fn(),
  normalizeVerificationDestination: jest.fn((_method: string, value: string) => value),
  readVerificationProfile: jest.fn().mockResolvedValue({ method: 'none', destination: '' }),
  removeOtherTotpFactors: jest.fn(),
  sendContactCode: jest.fn(),
  verifyContactCode: jest.fn(),
  verifyFactor: jest.fn(),
  VERIFICATION_METHODS: [
    {
      id: 'totp',
      label: 'Authenticator app (QR code)',
      shortLabel: 'QR code',
      description: 'Scan a QR code with an authenticator app.',
      destinationLabel: 'Authenticator app',
      destinationPlaceholder: '',
      recommended: true,
    },
  ],
}));

jest.mock('../supabase/client', () => ({ supabase: null }));

// react-scripts enables resetMocks, so implementations must be re-applied.
beforeEach(() => {
  (activeVerificationMethod as jest.Mock).mockResolvedValue(null);
  (readVerificationProfile as jest.Mock).mockResolvedValue({
    method: 'none',
    destination: '',
    verifiedAt: '',
    disabled: false,
  });
  (disableVerification as jest.Mock).mockResolvedValue(0);
});

describe('Active Login Sessions disclosure', () => {
  it('hides the session details until the arrow button is pressed', async () => {
    await act(async () => {
      render(<ProfileSecurityPanel editing={false} email="admin@example.com" />);
    });

    expect(screen.getByText('Laptop / desktop (Windows)')).toBeInTheDocument();
    expect(screen.getByText('Signed in')).not.toBeVisible();

    const toggle = screen.getByRole('button', { name: 'Show session details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getByText('Signed in')).toBeVisible();
    expect(screen.getByText('Time zone')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hide session details' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide session details' }));
    expect(screen.getByText('Signed in')).not.toBeVisible();
  });

  it('keeps the sign-out button in the card header and Log Out All Other Sessions clickable', async () => {
    await act(async () => {
      render(<ProfileSecurityPanel editing={false} email="admin@example.com" />);
    });

    const signOut = screen.getByRole('button', { name: 'Sign Out This Device' });
    expect(signOut.closest('header')).not.toBeNull();
    expect(signOut.parentElement).toHaveClass('profile-security-session-aside');

    // Only one device is listed, but the button must still work: it revokes
    // refresh tokens on the server even for devices that are not in the list.
    expect(screen.getByRole('button', { name: 'Log Out All Other Sessions' })).toBeEnabled();
  });
});

describe('Sign-in Verification method cards', () => {
  it('shows the Recommended badge in the authenticator card', async () => {
    await act(async () => {
      render(<ProfileSecurityPanel editing={false} email="admin@example.com" />);
    });

    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('keeps sign-in verification available alongside active login sessions', async () => {
    await act(async () => {
      render(<ProfileSecurityPanel editing={false} email="doctor@example.com" />);
    });

    expect(screen.getByText('Sign-in Verification')).toBeInTheDocument();
    expect(screen.getByText('Active Login Sessions')).toBeInTheDocument();
  });

  it('shows only Turn Off Verification while a method is active', async () => {
    (activeVerificationMethod as jest.Mock).mockResolvedValueOnce('totp');

    await act(async () => {
      render(<ProfileSecurityPanel editing={false} email="doctor@example.com" />);
    });

    expect(await screen.findByRole('button', { name: 'Turn Off Verification' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show QR Code' })).not.toBeInTheDocument();
  });

  it('returns to the QR setup after turning verification off without edit mode', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    (activeVerificationMethod as jest.Mock).mockResolvedValueOnce('totp');
    (disableVerification as jest.Mock).mockResolvedValueOnce(0);

    await act(async () => {
      render(<ProfileSecurityPanel editing={false} email="doctor@example.com" />);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Turn Off Verification' }));

    expect(await screen.findByText('Sign-in verification is turned off.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show QR Code' })).toBeEnabled();
    confirmSpy.mockRestore();
  });
});
