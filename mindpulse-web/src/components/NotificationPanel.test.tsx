import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NotificationPanel } from './NotificationPanel';
import { NotificationHistorySheet } from './NotificationHistorySheet';
import { AdminNotificationsView } from '../views/admin/AdminNotificationsView';
import {
  categoryForNotification,
  dismissFeedNotification,
  FeedNotification,
  fetchAllNotifications,
  fetchFeedNotifications,
  markFeedNotificationRead,
  notificationCategoryForPath,
} from '../services/notifications';

jest.mock('../services/notifications', () => ({
  ...jest.requireActual('../services/notifications'),
  fetchFeedNotifications: jest.fn(),
  fetchAllNotifications: jest.fn(),
  markFeedNotificationRead: jest.fn(),
  dismissFeedNotification: jest.fn(),
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
    title: 'Critical Patient Alert',
    message: 'A patient received a high stress score.',
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
  mockFetchFeedNotifications.mockResolvedValue({ notifications: sampleNotifications, hiddenCount: 0 });
  mockFetchAllNotifications.mockResolvedValue({ notifications: sampleNotifications, hiddenCount: 0 });
});

test('shows only notifications for the active section', async () => {
  mockFetchFeedNotifications.mockResolvedValue({ notifications: sampleNotifications, hiddenCount: 0 });

  render(<div className="admin-scope"><NotificationPanel /></div>);

  expect(await screen.findByText('Doctor Capacity Reached')).toBeInTheDocument();
  expect(screen.queryByText('Critical Patient Alert')).not.toBeInTheDocument();
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
  expect(within(dialog).getByText('Critical Patient Alert')).toBeInTheDocument();
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

test('maps doctor portal routes to the proper notification section', () => {
  expect(notificationCategoryForPath('/dashboard')).toBe('all');
  expect(notificationCategoryForPath('/cases')).toBe('cases');
  expect(notificationCategoryForPath('/consultations')).toBe('consultations');
  expect(notificationCategoryForPath('/suggestions')).toBe('suggestions');
  expect(notificationCategoryForPath('/transactions')).toBe('transactions');
});

test('returns from notifications to the source route', async () => {
  window.history.pushState({}, '', '/notifications?category=results&from=%2Fresults');
  mockFetchFeedNotifications.mockResolvedValue({ notifications: [], hiddenCount: 0 });
  const onNavigate = jest.fn();

  render(<AdminNotificationsView onNavigate={onNavigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

  expect(onNavigate).toHaveBeenCalledWith('/results');
});

test('tapping an admin notification marks it read and tells the caller', async () => {
  (markFeedNotificationRead as jest.Mock).mockResolvedValue(undefined);
  const onNavigate = jest.fn();
  const onChanged = jest.fn();

  render(<AdminNotificationsView onNavigate={onNavigate} embedded onChanged={onChanged} />);
  fireEvent.click(await screen.findByRole('heading', { name: 'Doctor Capacity Reached' }));

  await waitFor(() => expect(markFeedNotificationRead).toHaveBeenCalledWith('user-alert'));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(onNavigate).toHaveBeenCalledWith('/users');
});

test('the full notifications page marks a tapped card read too', async () => {
  (markFeedNotificationRead as jest.Mock).mockResolvedValue(undefined);
  const onChanged = jest.fn();

  render(<AdminNotificationsView onNavigate={jest.fn()} onChanged={onChanged} />);
  fireEvent.click(await screen.findByRole('heading', { name: 'Doctor Capacity Reached' }));

  await waitFor(() => expect(markFeedNotificationRead).toHaveBeenCalledWith('user-alert'));
  expect(onChanged).toHaveBeenCalledTimes(1);
});

test('dismissing an admin notification removes the card and tells the caller (B-2)', async () => {
  (dismissFeedNotification as jest.Mock).mockResolvedValue(undefined);
  const onChanged = jest.fn();

  render(<AdminNotificationsView onNavigate={jest.fn()} embedded onChanged={onChanged} />);
  const heading = await screen.findByRole('heading', { name: 'Doctor Capacity Reached' });
  fireEvent.click(within(heading.closest('article') as HTMLElement).getByRole('button', { name: 'Archive' }));

  await waitFor(() => expect(dismissFeedNotification).toHaveBeenCalledWith('user-alert'));
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Doctor Capacity Reached' })).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('heading', { name: 'Critical Patient Alert' })).toBeInTheDocument();
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

test('a failed dismiss keeps the row and surfaces the error (B-2)', async () => {
  (dismissFeedNotification as jest.Mock).mockRejectedValue(new Error('Could not reach the server'));

  render(<AdminNotificationsView onNavigate={jest.fn()} embedded />);
  const heading = await screen.findByRole('heading', { name: 'Doctor Capacity Reached' });
  fireEvent.click(within(heading.closest('article') as HTMLElement).getByRole('button', { name: 'Archive' }));

  expect(await screen.findByText('Could not reach the server')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Doctor Capacity Reached' })).toBeInTheDocument();
});

test('the doctor history sheet dismisses a row straight from the list (B-2)', async () => {
  (dismissFeedNotification as jest.Mock).mockResolvedValue(undefined);
  const onChanged = jest.fn();

  render(<NotificationHistorySheet scope="doctor" onClose={jest.fn()} onChanged={onChanged} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Dismiss notification: Doctor Capacity Reached' }));

  await waitFor(() => expect(dismissFeedNotification).toHaveBeenCalledWith('user-alert'));
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Dismiss notification: Doctor Capacity Reached' }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('button', { name: 'Dismiss notification: Critical Patient Alert' })).toBeInTheDocument();
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});