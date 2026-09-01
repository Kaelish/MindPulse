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

test('registers a new account through Supabase', async () => {
  const mockedSignUp = (supabase?.auth?.signUp as jest.Mock | undefined) ?? jest.fn();
  mockedSignUp.mockResolvedValue({ data: { user: null }, error: null });

  render(<App />);

  fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alice Test' } });
  fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'alice@example.com' } });
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'Pass1234!' } });
  fireEvent.click(screen.getByRole('button', { name: /Create account/i }));

  await waitFor(() => {
    expect(mockedSignUp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'Pass1234!',
      options: { data: { full_name: 'Alice Test' } },
    });
  });
});
