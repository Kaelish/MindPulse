/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
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
