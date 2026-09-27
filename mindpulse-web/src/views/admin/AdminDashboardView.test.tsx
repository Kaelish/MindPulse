import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminDashboardView } from './AdminDashboardView';
import { fetchAdminDashboardCharts, fetchAdminOverview } from '../../services/admin';
import { fetchUnreadNotificationCount } from '../../services/notifications';

jest.mock('../../services/admin', () => ({
  fetchAdminOverview: jest.fn(),
  fetchAdminDashboardCharts: jest.fn(),
}));

jest.mock('../../services/notifications', () => ({
  ...jest.requireActual('../../services/notifications'),
  fetchUnreadNotificationCount: jest.fn(),
}));

const overview = {
  students: 4,
  doctors: 2,
  admins: 1,
  sessions: 9,
  appointments: 1,
  low: 2,
  moderate: 1,
  high: 1,
  assessed: 4,
  pendingApprovals: 0,
};

beforeEach(() => {
  window.history.pushState({}, '', '/dashboard');
  (fetchAdminOverview as jest.Mock).mockResolvedValue(overview);
  (fetchAdminDashboardCharts as jest.Mock).mockResolvedValue({ statuses: [], weeks: [] });
  (fetchUnreadNotificationCount as jest.Mock).mockResolvedValue(0);
});

test('keeps the bell dot hidden while nothing is unread', async () => {
  render(<AdminDashboardView onSignOut={jest.fn()} />);

  const bell = await screen.findByRole('button', { name: 'Notifications' });
  expect(fetchUnreadNotificationCount).toHaveBeenCalled();
  expect(bell.querySelector('span')).toBeNull();
});

test('shows the bell dot as soon as an unread notification exists', async () => {
  (fetchUnreadNotificationCount as jest.Mock).mockResolvedValue(3);

  render(<AdminDashboardView onSignOut={jest.fn()} />);

  const bell = await screen.findByRole('button', { name: 'Notifications, 3 unread' });
  expect(bell.querySelector('span')).not.toBeNull();
});

test('refreshes the unread dot when the panel reports a change', async () => {
  (fetchUnreadNotificationCount as jest.Mock).mockResolvedValueOnce(1).mockResolvedValue(0);

  render(<AdminDashboardView onSignOut={jest.fn()} />);

  const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
  await waitFor(() => expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(1));

  fireEvent.click(bell);
  await waitFor(() => expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(bell.querySelector('span')).toBeNull());
});
