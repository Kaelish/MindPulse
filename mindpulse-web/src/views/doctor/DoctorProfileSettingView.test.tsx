import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DoctorProfileSettingView } from './DoctorProfileSettingView';
import { DoctorProfileData, fetchDoctorProfile, saveDoctorProfile } from '../../services/doctorProfile';
import { uploadProfileAvatar } from '../../services/profileAvatar';

jest.mock('../../services/doctorProfile', () => ({
  fetchDoctorProfile: jest.fn(),
  saveDoctorProfile: jest.fn(),
}));

jest.mock('../../services/profileAvatar', () => ({
  uploadProfileAvatar: jest.fn(),
}));

jest.mock('../../components/doctor/DoctorChrome', () => ({
  DoctorError: () => null,
  DoctorLoading: () => null,
  DoctorNotifications: () => null,
}));

jest.mock('../../supabase/client', () => ({ supabase: null }));

const profile: DoctorProfileData = {
  userId: 'doc-1',
  firstName: 'Monroe',
  lastName: 'Leclair',
  middleInitial: '',
  title: 'Dr.',
  preferredLanguage: 'English',
  email: 'dr.monroe@example.com',
  phone: '',
  licenseId: '',
  specialty: 'Guidance Counselor',
  department: 'Guidance',
  yearsExperience: '',
  startDate: '',
  dob: '',
  gender: '',
  streetAddress: '',
  avatarUrl: null,
  isVerified: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchDoctorProfile as jest.Mock).mockResolvedValue(profile);
  (saveDoctorProfile as jest.Mock).mockResolvedValue({ success: true });
});

const startEditing = async () => {
  render(<DoctorProfileSettingView />);
  const editButton = await screen.findByRole('button', { name: 'Edit Profile' });
  fireEvent.click(editButton);
  return screen.getByLabelText('First Name');
};

describe('DoctorProfileSettingView save behaviour', () => {
  it('keeps profile fields locked until Edit Profile is pressed and exposes Gender as a dropdown', async () => {
    render(<DoctorProfileSettingView />);
    const firstName = await screen.findByLabelText('First Name');
    const gender = screen.getByLabelText('Gender');
    expect(firstName).toHaveAttribute('readonly');
    expect(gender).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    expect(screen.getByLabelText('First Name')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Gender')).toBeEnabled();
    expect(screen.getByLabelText('Gender').tagName).toBe('SELECT');
  });

  it('rejects an invalid email address', async () => {
    await startEditing();
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(document.getElementById('doctor-profile-form') as HTMLFormElement);

    expect(await screen.findByRole('alert')).toHaveTextContent('valid email address');
    expect(saveDoctorProfile).not.toHaveBeenCalled();
  });

  it('rejects non-numeric phone values and no-op saves', async () => {
    await startEditing();
    fireEvent.change(screen.getByLabelText('Direct Contact Phone'), { target: { value: '123-45' } });
    fireEvent.submit(document.getElementById('doctor-profile-form') as HTMLFormElement);
    expect(await screen.findByRole('alert')).toHaveTextContent('digits only');

    fireEvent.change(screen.getByLabelText('Direct Contact Phone'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    fireEvent.submit(document.getElementById('doctor-profile-form') as HTMLFormElement);
    expect(await screen.findByRole('alert')).toHaveTextContent('No changes to save');
    expect(saveDoctorProfile).not.toHaveBeenCalled();
  });

  it('displays the saved honorific and normalized phone beside email', async () => {
    const doctorProfile = { ...profile, phone: '09171234567' };
    (fetchDoctorProfile as jest.Mock).mockResolvedValue(doctorProfile);
    render(<DoctorProfileSettingView />);

    expect(await screen.findByRole('heading', { name: 'Dr. Monroe Leclair' })).toBeInTheDocument();
    expect(screen.getByText('+63 9171234567')).toBeInTheDocument();
  });

  it('does not save to the backend when Enter is pressed in a field', async () => {
    const input = await startEditing();
    fireEvent.change(input, { target: { value: 'Monroe Jr' } });

    // Enter must be swallowed so it can never trigger the form's onSubmit.
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter' });
    expect(notPrevented).toBe(false);
    expect(saveDoctorProfile).not.toHaveBeenCalled();
  });

  it('does not save when switching tabs, and keeps the typed edits on screen', async () => {
    const input = await startEditing();
    fireEvent.change(input, { target: { value: 'Monroe Jr' } });

    fireEvent.click(screen.getByRole('button', { name: 'Professional Credentials' }));
    expect(saveDoctorProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Personal Information' }));
    expect(screen.getByLabelText('First Name')).toHaveValue('Monroe Jr');
    // Edits survive the tab switch, so Save Changes stays available.
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(saveDoctorProfile).not.toHaveBeenCalled();
  });

  it('writes to the backend only when Save Changes is pressed', async () => {
    const input = await startEditing();
    fireEvent.change(input, { target: { value: 'Monroe Jr' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(saveDoctorProfile).toHaveBeenCalledTimes(1));
    expect(saveDoctorProfile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'doc-1', firstName: 'Monroe Jr' }),
    );
  });

  it('reverts the edits when Cancel is pressed', async () => {
    const input = await startEditing();
    fireEvent.change(input, { target: { value: 'Monroe Jr' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('First Name')).toHaveValue('Monroe');
    expect(saveDoctorProfile).not.toHaveBeenCalled();
  });
});
