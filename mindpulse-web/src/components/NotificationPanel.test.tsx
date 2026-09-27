import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationPanel } from './NotificationPanel';
import { categoryForNotification, FeedNotification, fetchFeedNotifications } from '../services/notifications';

jest.mock('../services/notifications', () => ({
  ...jest.requireActual('../services/notifications'),
  fetchFeedNotifications: jest.fn(),
}));

const sampleNotifications: FeedNotification[] = [
  {
    id: 'user-alert',
    userId: 'admin',
    title: 'Doctor Capacity Reached',
    message: 'A doctor reached the maximum patient capacity.',
    type: 'alert',
    category: 'users',
    read: false,
    createdAt: '2026-09-27T10:00:00.000Z',
  },
  {
    id: 'result-alert',
    userId: 'admin',
    title: 'Critical Student Alert',
    message: 'A student received a high stress score.',
    type: 'alert',
    category: 'results',
    read: false,
    createdAt: '2026-09-27T09:00:00.000Z',
  },
];

const mockFetchFeedNotifications = fetchFeedNotifications as jest.Mock;

beforeEach(() => {
  window.history.pushState({}, '', '/users');
  mockFetchFeedNotifications.mockReset();
});

test('shows only notifications for the active section', async () => {
  mockFetchFeedNotifications.mockResolvedValue({ notifications: sampleNotifications, hiddenCount: 0 });

  render(<div className="admin-scope"><NotificationPanel /></div>);

  expect(await screen.findByText('Doctor Capacity Reached')).toBeInTheDocument();
  expect(screen.queryByText('Critical Student Alert')).not.toBeInTheDocument();
});

test('shows a contextual empty state and keeps Show more available', async () => {
  window.history.pushState({}, '', '/results');
  mockFetchFeedNotifications.mockResolvedValue({ notifications: [sampleNotifications[0]], hiddenCount: 0 });

  render(<div className="admin-scope"><NotificationPanel /></div>);

  expect(await screen.findByText('No notifications for Results')).toBeInTheDocument();
  expect(screen.getByText("You're all caught up for this section.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

  await waitFor(() => {
    expect(window.location.pathname).toBe('/notifications');
    expect(window.location.search).toBe('?category=results');
  });
});

test('classifies scan-related appointment alerts as Results', () => {
  expect(categoryForNotification({
    title: 'Critical Scan Score Logged',
    message: 'Follow-up appointment requested after high stress detection.',
    type: 'appointment',
  })).toBe('results');
});

test('classifies assessment form edits as Assessment Tools', () => {
  expect(categoryForNotification({
    title: 'New form edits published',
    message: 'Assessment form changes are available.',
    type: 'info',
  })).toBe('assessment-tools');
});