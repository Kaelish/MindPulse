import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { supabase } from './supabase/client';

jest.mock('./supabase/client', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
  },
}));

test('registers a doctor account with professional details for approval', async () => {
  const mockedSignUp = (supabase?.auth?.signUp as jest.Mock | undefined) ?? jest.fn();
  mockedSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });

  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Register as a doctor' }));

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maria' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Cruz' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText('License number'), { target: { value: 'PRC-0012345' } });
  fireEvent.change(screen.getByLabelText('Specialization'), { target: { value: 'Clinical Psychologist' } });
  fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09171234567' } });
  fireEvent.change(screen.getByLabelText('Short bio'), { target: { value: 'Six years of practice.' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Pass2026' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Str0ng!Pass2026' } });
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
          license_no: 'PRC-0012345',
          specialization: 'Clinical Psychologist',
          contact_number: '09171234567',
          bio: 'Six years of practice.',
        },
      },
    });
  });
});
