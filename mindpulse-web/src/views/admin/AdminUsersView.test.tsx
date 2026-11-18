import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminUsersView } from './AdminUsersView';
import { AdminAccountRow, fetchAdminAccounts } from '../../services/admin';
import { requireUserId } from '../../services/session';

jest.mock('../../services/admin', () => ({
  fetchAdminAccounts: jest.fn(),
  approveDoctor: jest.fn(),
  denyDoctor: jest.fn(),
  reactivateAccount: jest.fn(),
  setDoctorVerified: jest.fn(),
}));
jest.mock('../../services/session', () => ({ requireUserId: jest.fn() }));
jest.mock('../../components/navigation/AdminSidebar', () => ({ AdminSidebar: () => null }));
jest.mock('../../components/NotificationBell', () => ({ NotificationBell: () => null }));
jest.mock('../../components/NotificationPanel', () => ({ NotificationPanel: () => null }));

const account = (overrides: Partial<AdminAccountRow>): AdminAccountRow => ({
  id: 'user-1',
  role: 'doctor',
  name: 'Dr. Reyes',
  initials: 'DR',
  avatarUrl: null,
  email: 'reyes@example.com',
  phone: null,
  program: 'Clinical Psychology',
  year: '',
  studentNo: null,
  patients: 4,
  isVerified: true,
  onboardingComplete: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  latestScore: null,
  latestLevel: null,
  licenseNo: 'LIC-1',
  contactNumber: null,
  bio: null,
  isDeactivated: false,
  deactivatedAt: null,
  ...overrides,
});

const mockFetch = fetchAdminAccounts as jest.Mock;
const mockRequireUserId = requireUserId as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireUserId.mockResolvedValue('admin-1');
  mockFetch.mockResolvedValue([account({})]);
});

const renderUsers = () => render(<AdminUsersView onSignOut={jest.fn()} onNavigate={jest.fn()} />);

const summary = () => within(screen.getByRole('region', { name: 'Account summary' }));

test('the default list asks for live accounts and keeps the full summary', async () => {
  renderUsers();

  expect(await screen.findByText('Dr. Reyes')).toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledWith('doctor', { includeDeactivated: false });
  expect(summary().getByText('Total Accounts')).toBeInTheDocument();
  expect(summary().queryByText('Deactivated')).not.toBeInTheDocument();
});

test('the Deactivated view asks for archived accounts only and offers Reactivate', async () => {
  mockFetch.mockResolvedValue([account({ isDeactivated: true, isVerified: false })]);
  renderUsers();
  await screen.findByText('Dr. Reyes');

  fireEvent.click(screen.getByRole('button', { name: 'Deactivated' }));

  await waitFor(() => expect(mockFetch).toHaveBeenLastCalledWith('doctor', { includeDeactivated: true }));
  const table = within(await screen.findByRole('table'));
  expect(table.getByText('Dr. Reyes')).toBeInTheDocument();
  expect(table.getByText('Inactive')).toBeInTheDocument();
  expect(table.queryByText('Active')).not.toBeInTheDocument();
  expect(table.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  expect(summary().getByText('Deactivated')).toBeInTheDocument();
  expect(summary().queryByText('Total Accounts')).not.toBeInTheDocument();
});

test('the Deactivated view stays empty when no account has been deactivated', async () => {
  mockFetch.mockResolvedValue([]);
  renderUsers();
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  fireEvent.click(screen.getByRole('button', { name: 'Deactivated' }));

  expect(await screen.findByText('No deactivated doctor accounts.')).toBeInTheDocument();
  expect(summary().getByText('Deactivated')).toBeInTheDocument();
  expect(summary().getByText('0')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
});
