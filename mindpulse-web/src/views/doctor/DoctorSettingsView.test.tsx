import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DoctorSettingsView } from './DoctorSettingsView';
import { DOCTOR_SETTINGS_STORAGE_KEY } from '../../services/doctorSettings';

jest.mock('../../components/doctor/DoctorChrome', () => ({
  DoctorNotifications: () => null,
}));

const NOTIF_PREFS_KEY = 'mindpulse.web.notificationPrefs';

describe('DoctorSettingsView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.doctorTheme;
  });

  it('leaves the appearance and notification switches usable without an Edit step', () => {
    render(<DoctorSettingsView />);

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(5);
    switches.forEach((button) => expect(button).not.toBeDisabled());

    // Every preference auto-applies, so there is no Edit/Save gate anywhere.
    expect(screen.queryByRole('button', { name: 'Edit Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  it('applies Dark Mode immediately and persists it without a save button', () => {
    render(<DoctorSettingsView />);

    const [darkMode] = screen.getAllByRole('switch');
    const wasOn = darkMode.getAttribute('aria-checked') === 'true';
    fireEvent.click(darkMode);

    expect(darkMode.getAttribute('aria-checked')).toBe(String(!wasOn));
    expect(document.documentElement.dataset.doctorTheme).toBe(!wasOn ? 'dark' : 'light');
    expect(JSON.parse(window.localStorage.getItem(DOCTOR_SETTINGS_STORAGE_KEY) ?? '{}').darkMode).toBe(!wasOn);
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  it('saves notification switches immediately', () => {
    render(<DoctorSettingsView />);

    const switches = screen.getAllByRole('switch');
    const email = switches[1];
    const wasOn = email.getAttribute('aria-checked') === 'true';
    fireEvent.click(email);

    const stored = JSON.parse(window.localStorage.getItem(NOTIF_PREFS_KEY) ?? '{}');
    expect(stored.email).toBe(!wasOn);
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  it('lets the landing view be changed directly and saves it', () => {
    render(<DoctorSettingsView />);

    const landing = screen.getByRole('combobox', { name: 'Default landing view' });
    expect(landing).not.toBeDisabled();

    fireEvent.change(landing, { target: { value: 'student-cases' } });
    expect(landing).toHaveValue('student-cases');
    expect(JSON.parse(window.localStorage.getItem(DOCTOR_SETTINGS_STORAGE_KEY) ?? '{}').landingView).toBe('student-cases');
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  it('restores a saved landing view on the next visit', () => {
    window.localStorage.setItem(
      DOCTOR_SETTINGS_STORAGE_KEY,
      JSON.stringify({ darkMode: false, landingView: 'assessment-results' }),
    );

    render(<DoctorSettingsView />);

    expect(screen.getByRole('combobox', { name: 'Default landing view' })).toHaveValue('assessment-results');
  });
});
