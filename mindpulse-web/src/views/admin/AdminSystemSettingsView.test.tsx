import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AdminSystemSettingsView } from './AdminSystemSettingsView';
import { ADMIN_SETTINGS_STORAGE_KEY } from '../../services/adminSettings';

jest.mock('../../components/navigation/AdminSidebar', () => ({
  AdminSidebar: () => null,
}));

jest.mock('../../components/NotificationBell', () => ({
  NotificationBell: () => null,
}));

jest.mock('../../components/NotificationPanel', () => ({
  NotificationPanel: () => null,
}));

jest.mock('../../services/dataExport', () => ({
  exportSystemData: jest.fn().mockResolvedValue('mindpulse-export.json'),
}));

const storedSettings = () =>
  JSON.parse(window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY) ?? '{}');

const renderView = () =>
  render(<AdminSystemSettingsView onSignOut={jest.fn()} onNavigate={jest.fn()} />);

describe('AdminSystemSettingsView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'light';
    document.title = 'MindPulse';
  });

  it('applies Dark Mode and Compact View immediately, with no Save Changes step', () => {
    renderView();

    const darkMode = screen.getByLabelText(/Dark Mode/);
    const compact = screen.getByLabelText(/Compact View/);
    expect(darkMode).not.toBeDisabled();
    expect(compact).not.toBeDisabled();

    fireEvent.click(darkMode);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(storedSettings().general.darkMode).toBe(true);
    expect(screen.queryByRole('button', { name: /Save Changes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Settings' })).toBeInTheDocument();
  });

  it('saves High Stress Alerts from the Notification tab without Edit/Save', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Notification' }));
    expect(screen.queryByRole('button', { name: 'Edit Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/ })).not.toBeInTheDocument();

    const highStress = screen.getByLabelText(/High Stress Alerts/);
    const wasOn = (highStress as HTMLInputElement).checked;
    fireEvent.click(highStress);

    expect(storedSettings().notification.highStressAlerts).toBe(!wasOn);
  });

  it('leaves Data Export usable without entering edit mode', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Data' }));

    expect(screen.getByRole('button', { name: /Export Data/ })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/ })).not.toBeInTheDocument();
  });

  it('applies Session Timeout and Require Special Characters immediately', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));

    const timeout = screen.getByLabelText(/Session Timeout/);
    const wasTimeoutOn = (timeout as HTMLInputElement).checked;
    fireEvent.click(timeout);
    expect(storedSettings().security.sessionTimeout).toBe(!wasTimeoutOn);

    const special = screen.getByLabelText(/Require Special Characters/);
    const wasSpecialOn = (special as HTMLInputElement).checked;
    fireEvent.click(special);
    expect(storedSettings().security.requireSpecialChars).toBe(!wasSpecialOn);
  });

  it('keeps Edit/Save for the minimum password length only', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));

    const minLength = screen.getByRole('combobox');
    expect(minLength).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Settings' }));
    expect(minLength).not.toBeDisabled();

    fireEvent.change(minLength, { target: { value: '12 characters' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    expect(storedSettings().security.minPasswordLength).toBe('12 characters');
    expect(screen.getByRole('button', { name: 'Edit Settings' })).toBeInTheDocument();
  });

  it('keeps Edit/Save for System Information', () => {
    renderView();

    const systemName = screen.getByLabelText('System Name');
    expect(systemName).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Settings' }));
    expect(systemName).not.toBeDisabled();

    fireEvent.change(systemName, { target: { value: 'MindPulse Clinic' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    expect(storedSettings().general.systemName).toBe('MindPulse Clinic');
    expect(document.title).toBe('MindPulse Clinic');
  });
});
