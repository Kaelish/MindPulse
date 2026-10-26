/**
 * @format
 */

import React from 'react';
const ReactTestRenderer = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => unknown;
};
import App from '../App';

test('renders the splash screen entry point', async () => {
  jest.useFakeTimers();
  try {
    await ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<App />);
      jest.advanceTimersByTime(1600);
    });
  } finally {
    jest.useRealTimers();
  }
});
