import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminProfileSettingsView } from './AdminProfileSettingsView';
import { fetchOwnProfile, updateOwnProfile } from '../../services/profile';

jest.mock('../../services/profile', () => ({
  fetchOwnProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
  changeOwnPassword: jest.fn(),
}));
jest.mock('../../services/profileAvatar', () => ({ uploadProfileAvatar: jest.fn() }));
jest.mock('../../components/navigation/AdminSidebar', () => ({ AdminSidebar: () => null }));
jest.mock('../../components/NotificationBell', () => ({ NotificationBell: () => null }));
jest.mock('../../components/NotificationPanel', () => ({ NotificationPanel: () => null }));
jest.mock('../../components/ProfileSecurityPanel', () => ({
  ProfileSecurityPanel: ({ editing }: { editing: boolean }) => <div data-testid="shared-security" data-editing={String(editing)} />,
}));

const profile = {
  id: 'admin-1',
  first_name: 'Maya',
  last_name: 'Reyes',
  email: 'maya@example.com',
  phone: '09171234567',
  role: 'admin',
  department: 'Clinical Services',
  program: null,
  year_level: null,
  student_no: null,
  sex: 'Female',
  birth_date: null,
  living_situation: null,
  avatar_url: null,
  preferred_title: 'Dr.',
  clinic_address: 'Main Clinic',
  administrative_title: 'Clinic Director',
  medical_specialization: 'Clinical Psychology',
  professional_license_no: 'PRC-12345',
  clinic_name: 'MindPulse Clinic',
  privacy_scope: 'Data Privacy Officer',
  onboarding_complete: true,
  created_at: '2025-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchOwnProfile as jest.Mock).mockResolvedValue(profile);
  (updateOwnProfile as jest.Mock).mockResolvedValue(undefined);
});

const renderAdminProfile = async () => {
  render(<AdminProfileSettingsView onSignOut={jest.fn()} onNavigate={jest.fn()} />);
  await screen.findByLabelText('First Name');
};

it('locks fields until Edit Profile is pressed and provides a gender dropdown', async () => {
  await renderAdminProfile();
  expect(screen.getByText('Clinic Director')).toBeInTheDocument();
  expect(screen.getByLabelText('First Name')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Gender')).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  expect(screen.getByLabelText('First Name')).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('Gender').tagName).toBe('SELECT');
  expect(screen.getByLabelText('Gender')).toBeEnabled();
});

it('keeps Edit Profile available on Security and locks its controls until enabled', async () => {
  await renderAdminProfile();
  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
  expect(screen.getByTestId('shared-security')).toHaveAttribute('data-editing', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  expect(screen.getByTestId('shared-security')).toHaveAttribute('data-editing', 'true');
});

it('rejects invalid email, non-numeric phone, and unchanged saves', async () => {
  await renderAdminProfile();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  const form = document.getElementById('admin-profile-form') as HTMLFormElement;

  fireEvent.change(screen.getByLabelText('Work Email Address'), { target: { value: 'bad-email' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('valid email address');
  expect(updateOwnProfile).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Work Email Address'), { target: { value: profile.email } });
  fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '555-1234' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('numbers only');
  expect(updateOwnProfile).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: profile.phone } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('No changes to save');
  expect(updateOwnProfile).not.toHaveBeenCalled();
});

it('saves changes only after editing and submitting the form', async () => {
  await renderAdminProfile();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Maya R.' } });
  fireEvent.submit(document.getElementById('admin-profile-form') as HTMLFormElement);
  await waitFor(() => expect(updateOwnProfile).toHaveBeenCalledWith({ first_name: 'Maya R.' }));
});