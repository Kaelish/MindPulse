import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('moves from registration to the doctor dashboard', async () => {
  render(<App />);

  expect(screen.getByText(/Create your account/i)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole('button', { name: /Create account/i }).closest('form')!);
  fireEvent.click(screen.getByRole('button', { name: /Doctor Dashboard/i }));

  await waitFor(() => {
    expect(screen.getByText(/Patient list/i)).toBeInTheDocument();
  });

  expect(screen.getByText(/Today's schedule/i)).toBeInTheDocument();
  expect(screen.getByText(/Quick insights/i)).toBeInTheDocument();
});
