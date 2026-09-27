import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NotificationPanel } from './NotificationPanel';
import { AdminNotificationsView } from '../views/admin/AdminNotificationsView';
import {
  categoryForNotification,
  FeedNotification,
  fetchAllNotifications,
  fetchFeedNotifications,
} from '../services/notifications';

jest.mock('../services/notifications', () => ({
  ...jest.requireActual('../services/notifications'),
  fetchFeedNotifications: jest.fn(),
  fetchAllNotifications: jest.fn(),
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
const mockFetchAllNotifications = fetchAllNotifications as jest.Mock;

beforeEach(() => {
  window.history.pushState({}, '', '/users');
  mockFetchFeedNotifications.mockReset();
  mockFetchAllNotifications.mockReset();
  mockFetchAllNotifications.mockResolvedValue({ notifications: sampleNotifications, hiddenCount: 0 });
});

test('shows only notifications for the active section', async () => {
  mockFetchFeedNotifications.mockResolvedValue({ notifications: sampleNotifications, hiddenCount: 0 });

  render(<div className="admin-scope"><NotificationPanel /></div>);

  expect(await screen.findByText('Doctor Capacity Reached')).toBeInTheDocument();
  expect(screen.queryByText('Critical Student Alert')).not.toBeInTheDocument();
});

test('shows a contextual empty state without a See all button', async () => {
  window.history.pushState({}, '', '/results');
  mockFetchFeedNotifications.mockResolvedValue({ notifications: [sampleNotifications[0]], hiddenCount: 0 });

  render(<div className="admin-scope"><NotificationPanel /></div>);

  expect(await screen.findByText('No notifications for Results')).toBeInTheDocument();
  expect(screen.getByText("You're all caught up for this section.")).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /See all/ })).not.toBeInTheDocument();
});

test('See all opens the history popup without leaving the section', async () => {
  window.history.pushState({}, '', '/results');
  mockFetchFeedNotifications.mockResolvedValue({ notifications: [sampleNotifications[1]], hiddenCount: 0 });

  render(<div className="admin-scope"><NotificationPanel /></div>);
  fireEvent.click(await screen.findByRole('button', { name: /See all/ }));

  const dialog = await screen.findByRole('dialog', { name: 'View Notifications' });
  expect(within(dialog).getByText('Critical Student Alert')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/results');
});

test('clicking a notification row opens the popup on that notification', async () => {
  window.history.pushState({}, '', '/dashboard');
  mockFetchFeedNotifications.mockResolvedValue({ notifications: sampleNotifications, hiddenCount: 0 });

  render(<div className="admin-scope"><NotificationPanel /></div>);
  fireEvent.click(await screen.findByRole('button', { name: 'Open notification: Doctor Capacity Reached' }));

  const dialog = await screen.findByRole('dialog', { name: 'View Notifications' });
  expect(within(dialog).getByText('Doctor Capacity Reached')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/dashboard');
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

test('returns from notifications to the source route', async () => {
  window.history.pushState({}, '', '/notifications?category=results&from=%2Fresults');
  mockFetchFeedNotifications.mockResolvedValue({ notifications: [], hiddenCount: 0 });
  const onNavigate = jest.fn();

  render(<AdminNotificationsView onNavigate={onNavigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

  expect(onNavigate).toHaveBeenCalledWith('/results');
});