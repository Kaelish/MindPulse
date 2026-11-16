import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { supabase } from './supabase/client';
import { getCurrentUserRole } from './services/session';

jest.mock('./supabase/client', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      getSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

// App.tsx reads getCurrentUserRole for portal routing AND isAccountDeactivated
// for the 0042 deactivation gate. Both must exist on the mock: the module is
// replaced wholesale, so a missing export is `undefined` at the call site and
// routeToPortal() rejects before it can ever set the portal. That silently
// fails exactly the tests that sign a session in (pending screen, tab title).
jest.mock('./services/session', () => ({
  getCurrentUserRole: jest.fn(),
  isAccountDeactivated: jest.fn(),
}));

const mockedAuth = {
  signUp: supabase?.auth?.signUp as jest.Mock | undefined,
  getSession: supabase?.auth?.getSession as jest.Mock | undefined,
  signOut: supabase?.auth?.signOut as jest.Mock | undefined,
};

beforeEach(() => {
  mockedAuth.getSession?.mockResolvedValue({ data: { session: null } });
  (getCurrentUserRole as jest.Mock).mockReset();
});

test('registers a doctor account with professional details for approval', async () => {
  const mockedSignUp = mockedAuth.signUp ?? jest.fn();
  mockedSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });

  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Log In' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Register as a doctor' }));

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maria' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Cruz' } });
  fireEvent.change(screen.getByLabelText('Middle name (optional)'), { target: { value: 'Lourdes' } });
  fireEvent.change(screen.getByLabelText('Birthdate'), { target: { value: '1990-01-15' } });
  fireEvent.change(screen.getByLabelText('Title / Honorific'), { target: { value: 'Dr.' } });
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Female' } });
  fireEvent.change(screen.getByLabelText('Work email address'), { target: { value: 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText('License number'), { target: { value: 'PRC-0012345' } });
  fireEvent.change(screen.getByLabelText('Specialization'), { target: { value: 'Clinical Psychology' } });
  fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09171234567' } });
  fireEvent.change(screen.getByLabelText('Home address'), { target: { value: '12 Sampaguita St., Quezon City' } });
  fireEvent.change(screen.getByLabelText('Clinic address / location'), { target: { value: 'MindPulse Clinic, Quezon City' } });
  fireEvent.change(screen.getByLabelText('Short bio'), { target: { value: 'Six years of practice.' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Pass2026' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Str0ng!Pass2026' } });

  // Consent gates the sign-up (M-04 / B-3): without the tick nothing is sent.
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Please accept the Privacy Policy and Terms of Use to create your account.')).toBeInTheDocument();
  expect(mockedSignUp).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('checkbox', { name: /privacy policy/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

  await waitFor(() => {
    expect(mockedSignUp).toHaveBeenCalledWith({
      email: 'maria@example.com',
      password: 'Str0ng!Pass2026',
      options: {
        data: {
          role: 'doctor',
          first_name: 'Maria',
          last_name: 'Cruz',
          full_name: 'Maria Cruz',
          middle_name: 'Lourdes',
          mi: 'L',
          birth_date: '1990-01-15',
          home_address: '12 Sampaguita St., Quezon City',
          title: 'Dr.',
          sex: 'Female',
          clinic_address: 'MindPulse Clinic, Quezon City',
          license_no: 'PRC-0012345',
          specialization: 'Clinical Psychology',
          contact_number: '09171234567',
          bio: 'Six years of practice.',
          consent_source: 'web_signup',
        },
      },
    });
  });
});

test('register form supports Others specialization and password visibility toggles', async () => {
  const mockedSignUp = mockedAuth.signUp ?? jest.fn();
  mockedSignUp.mockClear();
  mockedSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });

  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Log In' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Register as a doctor' }));

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Dela Cruz' } });
  fireEvent.change(screen.getByLabelText('Birthdate'), { target: { value: '1988-06-02' } });
  fireEvent.change(screen.getByLabelText('Title / Honorific'), { target: { value: 'Dr.' } });
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Male' } });
  fireEvent.change(screen.getByLabelText('Work email address'), { target: { value: 'juan@example.com' } });
  fireEvent.change(screen.getByLabelText('License number'), { target: { value: 'PRC-0099999' } });
  fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09170000000' } });
  fireEvent.change(screen.getByLabelText('Home address'), { target: { value: '9 Mabini St., Manila' } });
  fireEvent.change(screen.getByLabelText('Clinic address / location'), { target: { value: 'MindPulse Manila' } });

  const passwordField = screen.getByLabelText('Password');
  expect(passwordField).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(passwordField).toHaveAttribute('type', 'text');

  const confirmField = screen.getByLabelText('Confirm password');
  expect(confirmField).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Show confirm password' }));
  expect(confirmField).toHaveAttribute('type', 'text');

  fireEvent.change(passwordField, { target: { value: 'Str0ng!Pass2026' } });
  fireEvent.change(confirmField, { target: { value: 'Str0ng!Pass2026' } });

  fireEvent.change(screen.getByLabelText('Specialization'), { target: { value: 'Others' } });
  expect(screen.getByLabelText('Other specialization')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByText(/Tell us your specialization/)).toBeInTheDocument();
  expect(mockedSignUp).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Other specialization'), {
    target: { value: 'Registered Guidance Counselor' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: /privacy policy/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

  await waitFor(() => {
    expect(mockedSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          data: expect.objectContaining({
            specialization: 'Registered Guidance Counselor',
          }),
        },
      }),
    );
  });
});

test('pending screen: Continue re-checks approval and Sign out returns to login', async () => {  mockedAuth.getSession?.mockResolvedValue({
    data: { session: { access_token: 'token', user: { id: 'doc-1' } } },
  });
  const mockedSignOut = mockedAuth.signOut ?? jest.fn();
  mockedSignOut.mockResolvedValue({ error: null });
  const mockedRole = getCurrentUserRole as jest.Mock;
  mockedRole.mockReset();
  mockedRole.mockResolvedValue('pending');

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Your registration is pending' })).toBeInTheDocument();
  expect(document.title).toBe('MindPulse');

  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('status')).toHaveTextContent(/still awaiting approval/i);
  expect(mockedRole).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(mockedSignOut).toHaveBeenCalledTimes(1);
});

test('landing Log In opens the web login and Back to home returns to the landing page', async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Log In' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Understand Your Stress. Connect with Care.',
    }),
  ).toBeInTheDocument();
});

test('tab title follows the portal instead of always showing the admin name', async () => {
  const { unmount } = render(<App />);
  await screen.findByRole('button', { name: 'Log In' });
  expect(document.title).toBe('MindPulse');
  unmount();

  mockedAuth.getSession?.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  const mockedRole = getCurrentUserRole as jest.Mock;
  mockedRole.mockReset();
  mockedRole.mockResolvedValue('doctor');

  render(<App />);
  await waitFor(() => expect(document.title).toBe('MindPulse Doctor Portal'));
});
