import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WebAuth } from './WebAuth';
import { supabase } from '../../supabase/client';

jest.mock('../../supabase/client', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const mockedAuth = supabase!.auth;

// react-scripts enables resetMocks, so every implementation is set per test.
beforeEach(() => {
  (mockedAuth.resetPasswordForEmail as jest.Mock).mockResolvedValue({ error: null });
  (mockedAuth.updateUser as jest.Mock).mockResolvedValue({ error: null });
  (mockedAuth.signOut as jest.Mock).mockResolvedValue({ error: null });
});

describe('password reset', () => {
  it('sends the recovery link back to the web portal origin', async () => {
    const setScreen = jest.fn();
    render(<WebAuth screen="forgot" setScreen={setScreen} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'patient@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() =>
      expect(mockedAuth.resetPasswordForEmail).toHaveBeenCalledWith('patient@example.com', {
        redirectTo: window.location.origin,
      }),
    );
    expect(await screen.findByText(/A reset link was sent to patient@example.com/)).toBeInTheDocument();
  });

  it('applies the new password from a recovery session and signs the link session out', async () => {
    const setScreen = jest.fn();
    render(<WebAuth screen="reset" setScreen={setScreen} />);

    fireEvent.change(screen.getByPlaceholderText('Enter your new password'), {
      target: { value: 'Str0ngPassword!' },
    });
    fireEvent.change(screen.getByPlaceholderText('Re-enter your new password'), {
      target: { value: 'Str0ngPassword!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => expect(mockedAuth.updateUser).toHaveBeenCalledWith({ password: 'Str0ngPassword!' }));
    await waitFor(() => expect(mockedAuth.signOut).toHaveBeenCalled());
    expect(setScreen).toHaveBeenCalledWith('login');
  });

  it('explains a missing recovery session instead of silently failing', async () => {
    (mockedAuth.updateUser as jest.Mock).mockResolvedValue({
      error: { message: 'Auth session missing!' },
    });
    const setScreen = jest.fn();
    render(<WebAuth screen="reset" setScreen={setScreen} />);

    fireEvent.change(screen.getByPlaceholderText('Enter your new password'), {
      target: { value: 'Str0ngPassword!' },
    });
    fireEvent.change(screen.getByPlaceholderText('Re-enter your new password'), {
      target: { value: 'Str0ngPassword!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(
      await screen.findByText('Open the reset link from your email first, then set a new password here.'),
    ).toBeInTheDocument();
    expect(mockedAuth.signOut).not.toHaveBeenCalled();
    expect(setScreen).not.toHaveBeenCalled();
  });
});

