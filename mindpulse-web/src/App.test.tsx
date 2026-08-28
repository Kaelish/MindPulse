import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders doctor dashboard shell with patient overview', async () => {
  render(<App />);

  expect(screen.getByText(/Doctor Dashboard/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/Patient list/i)).toBeInTheDocument();
  });

  expect(screen.getByText(/Today's schedule/i)).toBeInTheDocument();
  expect(screen.getByText(/Quick insights/i)).toBeInTheDocument();
});
