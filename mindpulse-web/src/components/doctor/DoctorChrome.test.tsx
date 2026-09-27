import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DoctorNotifications } from './DoctorChrome';
import {
  FeedNotification,
  fetchAllNotifications,
  fetchFeedNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  notificationFullTime,
  notificationTimeAgo,
} from '../../services/notifications';

jest.mock('../../services/notifications', () => ({
  fetchFeedNotifications: jest.fn(),
  fetchAllNotifications: jest.fn(),
  fetchUnreadNotificationCount: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  notificationTimeAgo: jest.fn(),
  notificationFullTime: jest.fn(),
}));

const feed: FeedNotification[] = [
  {
    id: 'n-recent',
    userId: 'doctor',
    title: 'Appointment confirmed',
    message: 'test student confirmed your consultation.',
    type: 'appointment',
    read: false,
    createdAt: '2026-09-26T16:45:00Z',
  },
];

const history: FeedNotification[] = [
  {
    id: 'n-old',
    userId: 'doctor',
    title: 'Weekly digest',
    message: 'Your week at a glance.',
    type: 'info',
    read: true,
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    id: 'n-new',
    userId: 'doctor',
    title: 'High stress alert',
    message: 'Liberty Lair scored 85% stress.',
    type: 'alert',
    read: false,
    createdAt: '2026-09-26T16:45:00Z',
  },
];

beforeEach(() => {
  (fetchFeedNotifications as jest.Mock).mockResolvedValue({ notifications: feed, hiddenCount: 0 });
  (fetchAllNotifications as jest.Mock).mockResolvedValue({ notifications: history, hiddenCount: 0 });
  (markAllNotificationsRead as jest.Mock).mockResolvedValue(0);
  (fetchUnreadNotificationCount as jest.Mock).mockResolvedValue(1);
  (notificationTimeAgo as jest.Mock).mockReturnValue('just now');
  (notificationFullTime as jest.Mock).mockImplementation((iso: string) =>
    iso.startsWith('2026-09-01') ? 'Sep 1, 2026, 9:00 AM' : 'Sep 26, 2026, 4:45 PM',
  );
});

test('opens the full history from See all, ordered past to recent', async () => {
  render(<DoctorNotifications />);

  const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
  fireEvent.click(bell);

  fireEvent.click(await screen.findByRole('button', { name: /See all/ }));

  const dialog = await screen.findByRole('dialog', { name: 'All notifications' });
  const rows = within(dialog).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('Weekly digest');
  expect(rows[0]).toHaveTextContent('Sep 1, 2026, 9:00 AM');
  expect(rows[1]).toHaveTextContent('High stress alert');
  expect(rows[1]).toHaveTextContent('Sep 26, 2026, 4:45 PM');
  expect(within(dialog).getByText('Unread')).toBeTruthy();
  expect(within(dialog).queryByText('Mark all as read')).toBeTruthy();
});

test('marks every notification as read and refreshes the badge', async () => {
  (fetchUnreadNotificationCount as jest.Mock).mockResolvedValueOnce(2).mockResolvedValue(0);

  render(<DoctorNotifications />);

  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
  fireEvent.click(await screen.findByRole('button', { name: /See all/ }));

  fireEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));

  await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(within(screen.getByRole('dialog')).queryByText('Unread')).toBeNull(),
  );
  expect(await screen.findByRole('button', { name: 'Notifications' })).toBeTruthy();
});

test('closes the full history on Escape without dropping the dropdown badge', async () => {
  render(<DoctorNotifications />);

  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  fireEvent.click(await screen.findByRole('button', { name: /See all/ }));
  expect(screen.getByRole('dialog')).toBeTruthy();

  fireEvent.keyDown(document, { key: 'Escape' });

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy();
});
