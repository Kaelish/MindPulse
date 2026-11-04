import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminConsentRegisterView } from './AdminConsentRegisterView';
import { ConsentRecord, fetchConsentRecords } from '../../services/adminConsent';

jest.mock('../../services/adminConsent', () => ({
  CONSENT_TYPES: ['registration', 'face_scan'],
  fetchConsentRecords: jest.fn(),
}));
jest.mock('../../components/navigation/AdminSidebar', () => ({ AdminSidebar: () => null }));
jest.mock('../../components/NotificationBell', () => ({ NotificationBell: () => null }));
jest.mock('../../components/NotificationPanel', () => ({ NotificationPanel: () => null }));

const records: ConsentRecord[] = [
  {
    id: 'c1',
    userId: 'u1',
    userName: 'Maria Cruz',
    userEmail: 'maria@example.com',
    consentType: 'registration',
    version: '1.0',
    grantedAt: '2026-11-01T08:30:00.000Z',
    withdrawnAt: null,
    source: 'mobile_signup',
  },
  {
    id: 'c2',
    userId: 'u2',
    userName: 'Juan Dela Cruz',
    userEmail: 'juan@example.com',
    consentType: 'face_scan',
    version: '1.0',
    grantedAt: '2026-11-02T09:00:00.000Z',
    withdrawnAt: null,
    source: 'mobile_face_scan',
  },
];

const mockFetch = fetchConsentRecords as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(records);
});

const renderRegister = () => render(<AdminConsentRegisterView onSignOut={jest.fn()} onNavigate={jest.fn()} />);

test('lists every proof with its account, type, version, source and withdrawal state', async () => {
  renderRegister();

  const table = within(await screen.findByRole('table'));
  expect(table.getByText('Maria Cruz')).toBeInTheDocument();
  expect(table.getByText('maria@example.com')).toBeInTheDocument();
  expect(table.getByText('registration')).toBeInTheDocument();
  expect(table.getByText('Juan Dela Cruz')).toBeInTheDocument();
  expect(table.getByText('face_scan')).toBeInTheDocument();
  expect(table.getByText('Mobile Signup')).toBeInTheDocument();
  expect(table.getByText('Mobile Face Scan')).toBeInTheDocument();
  // C-14: proof is never edited or removed, so the register ships no such control.
  expect(screen.queryByRole('button', { name: /delete|remove|edit|withdraw/i })).not.toBeInTheDocument();
});

test('filters by consent type and by name', async () => {
  renderRegister();
  await screen.findByRole('table');

  fireEvent.change(screen.getByLabelText('Filter by consent type'), { target: { value: 'face_scan' } });
  expect(within(screen.getByRole('table')).queryByText('Maria Cruz')).not.toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByText('Juan Dela Cruz')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Filter by consent type'), { target: { value: 'All consent types' } });
  fireEvent.change(screen.getByLabelText('Search consent records'), { target: { value: 'maria' } });
  expect(within(screen.getByRole('table')).getByText('Maria Cruz')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).queryByText('Juan Dela Cruz')).not.toBeInTheDocument();
});

test('shows a contextual empty state when nothing has been recorded yet', async () => {
  mockFetch.mockResolvedValue([]);
  renderRegister();

  expect(await screen.findByText(/No consent has been recorded yet/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('surfaces a failed read and retries on demand', async () => {
  mockFetch.mockRejectedValueOnce(new Error('permission denied for table consent_records'));
  renderRegister();

  expect(await screen.findByText('permission denied for table consent_records')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole('table')).toBeInTheDocument();
});
