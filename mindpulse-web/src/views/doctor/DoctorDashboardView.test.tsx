import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DoctorDashboardView } from './DoctorDashboardView';
import { fetchDoctorDashboardOverview, DoctorDashboardOverview } from '../../services/doctorDashboard';
import { fetchWebConsultations } from '../../services/consultations';

jest.mock('../../services/doctorDashboard', () => ({
  fetchDoctorDashboardOverview: jest.fn(),
}));

jest.mock('../../services/consultations', () => ({
  fetchWebConsultations: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../components/NotificationPanel', () => ({
  NotificationPanel: () => null,
}));

const overview: DoctorDashboardOverview = {
  activeCases: { value: 1, note: { text: 'No new cases this week', tone: 'neutral' } },
  pendingReviews: { value: 1, note: { text: 'Requires attention', tone: 'warning' } },
  highRiskStudents: { value: 0, note: { text: 'No students at high risk', tone: 'positive' } },
  completedThisWeek: { value: 0, note: { text: 'No sessions completed yet', tone: 'neutral' } },
  unreadNotifications: 1,
  recentCases: [
    {
      id: 'bd57192f',
      userId: 'bd57192f',
      name: 'test student',
      initials: 'TS',
      studentNo: 'BD57192F',
      stress: null,
      risk: 'No Assessment',
      activityLabel: 'No activity yet',
    },
    {
      id: 'liberty',
      userId: 'liberty',
      name: 'Liberty Lair',
      initials: 'LL',
      studentNo: 'STU-001',
      stress: 85,
      risk: 'High Risk',
      activityLabel: '2 hrs ago',
    },
  ],
  upcoming: [
    {
      id: 'appt-1',
      patientName: 'test student',
      initials: 'TS',
      status: 'scheduled',
      statusLabel: 'Scheduled',
      whenLabel: 'Yesterday, 4:45 PM',
      typeLabel: 'Initial Assessment',
      startsAt: Date.now(),
    },
  ],
};

const emptyOverview: DoctorDashboardOverview = {
  activeCases: { value: 0, note: { text: 'No new cases this week', tone: 'neutral' } },
  pendingReviews: { value: 0, note: { text: 'All caught up', tone: 'positive' } },
  highRiskStudents: { value: 0, note: { text: 'No students at high risk', tone: 'positive' } },
  completedThisWeek: { value: 0, note: { text: 'No sessions completed yet', tone: 'neutral' } },
  unreadNotifications: 0,
  recentCases: [],
  upcoming: [],
};

beforeEach(() => {
  (fetchWebConsultations as jest.Mock).mockResolvedValue([]);
});

test('renders live metrics, recent cases and upcoming consultations', async () => {
  (fetchDoctorDashboardOverview as jest.Mock).mockResolvedValue(overview);

  render(<DoctorDashboardView />);

  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
  expect(screen.getByText('Overview of your assigned cases and pending consultations')).toBeTruthy();

  expect(await screen.findByText('Active Cases')).toBeTruthy();
  expect(screen.getByText('Pending Reviews')).toBeTruthy();
  expect(screen.getByText('High Risk Students')).toBeTruthy();
  expect(screen.getByText('Completed this week')).toBeTruthy();
  expect(screen.getByText('Requires attention')).toBeTruthy();
  expect(screen.getByText('No new cases this week')).toBeTruthy();

  expect(screen.getAllByText('test student').length).toBeGreaterThan(0);
  expect(screen.getByText('BD57192F · No activity yet')).toBeTruthy();
  expect(screen.getByText('No assessment yet')).toBeTruthy();

  expect(screen.getByText('Liberty Lair')).toBeTruthy();
  expect(screen.getByText('85%')).toBeTruthy();
  expect(screen.getAllByText('High Risk').length).toBeGreaterThan(0);

  expect(screen.getByText('Yesterday, 4:45 PM')).toBeTruthy();
  expect(screen.getByText('Type: Initial Assessment')).toBeTruthy();
  expect(screen.getByText('Scheduled')).toBeTruthy();
});

test('shows empty states when the database has no rows yet', async () => {
  (fetchDoctorDashboardOverview as jest.Mock).mockResolvedValue(emptyOverview);

  render(<DoctorDashboardView />);

  await waitFor(() => expect(screen.getByText('No student cases yet')).toBeTruthy());
  expect(screen.getByText('No consultations scheduled')).toBeTruthy();
  expect(screen.getAllByText('0').length).toBeGreaterThan(0);
});
