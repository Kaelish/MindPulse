import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminActivityLogView } from './AdminActivityLogView';
import { ActivityEntry, fetchActivityLog } from '../../services/adminActivityLog';

jest.mock('../../services/adminActivityLog', () => ({
  LOGGED_ENTITIES: ['profiles', 'appointments', 'stress_sessions', 'consultation_notes'],
  fetchActivityLog: jest.fn(),
}));
jest.mock('../../components/navigation/AdminSidebar', () => ({ AdminSidebar: () => null }));
jest.mock('../../components/NotificationBell', () => ({ NotificationBell: () => null }));
jest.mock('../../components/NotificationPanel', () => ({ NotificationPanel: () => null }));

const entries: ActivityEntry[] = [
  {
    id: 'a1',
    actorName: 'Maria Cruz',
    action: 'created',
    entity: 'appointments',
    entityId: 'ABC12345',
    subjectLabel: null,
    createdAt: '2026-11-03T10:00:00.000Z',
  },
  {
    id: 'a2',
    actorName: 'System',
    action: 'created',
    entity: 'profiles',
    entityId: 'DEF67890',
    subjectLabel: 'New Student',
    createdAt: '2026-11-03T09:00:00.000Z',
  },
  {
    id: 'a3',
    actorName: 'Dr. Reyes',
    action: 'deleted',
    entity: 'consultation_notes',
    entityId: '1122AABB',
    subjectLabel: null,
    createdAt: '2026-11-03T08:00:00.000Z',
  },
];

const mockFetch = fetchActivityLog as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(entries);
});

const renderLog = () => render(<AdminActivityLogView onSignOut={jest.fn()} onNavigate={jest.fn()} />);

test('shows who did what to which record, with database-written rows marked as System', async () => {
  renderLog();

  const table = within(await screen.findByRole('table'));
  expect(table.getByText('Maria Cruz')).toBeInTheDocument();
  expect(table.getByText('Appointment')).toBeInTheDocument();
  expect(table.getByText('ABC12345')).toBeInTheDocument();

  // Rows written by the trigger itself have no auth.uid(): label them honestly.
  expect(table.getByText('System')).toBeInTheDocument();
  expect(table.getByText('Written by the database')).toBeInTheDocument();
  expect(table.getByText('New Student')).toBeInTheDocument();

  expect(table.getByText('Dr. Reyes')).toBeInTheDocument();
  expect(table.getByText('Consultation note')).toBeInTheDocument();
  expect(table.getAllByText('created')).toHaveLength(2);
  expect(table.getByText('deleted')).toBeInTheDocument();
});

test('filters by record type and by action', async () => {
  renderLog();
  await screen.findByRole('table');

  fireEvent.change(screen.getByLabelText('Filter by record type'), { target: { value: 'profiles' } });
  expect(within(screen.getByRole('table')).getByText('New Student')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).queryByText('ABC12345')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Filter by record type'), { target: { value: 'All records' } });
  fireEvent.change(screen.getByLabelText('Filter by action'), { target: { value: 'updated' } });
  expect(screen.getByText('No activity matches your filters.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('shows a contextual empty state when the log has nothing yet', async () => {
  mockFetch.mockResolvedValue([]);
  renderLog();

  expect(await screen.findByText(/Nothing has been recorded yet/)).toBeInTheDocument();
});

test('surfaces a failed read and retries on demand', async () => {
  mockFetch.mockRejectedValueOnce(new Error('permission denied for table activity_log'));
  renderLog();

  expect(await screen.findByText('permission denied for table activity_log')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole('table')).toBeInTheDocument();
});
