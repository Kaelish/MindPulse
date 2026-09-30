import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DoctorSettingsView } from './DoctorSettingsView';

jest.mock('../../components/doctor/DoctorChrome', () => ({
  DoctorNotifications: () => null,
}));

describe('DoctorSettingsView', () => {
  it('leaves the switches and the landing-view select usable without an Edit step', () => {
    render(<DoctorSettingsView />);

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(5);
    switches.forEach((button) => expect(button).not.toBeDisabled());

    const landing = screen.getByRole('combobox');
    expect(landing).not.toBeDisabled();
  });

  it('toggles a switch and offers Save Changes / Cancel once it is dirty', () => {
    render(<DoctorSettingsView />);

    const [darkMode] = screen.getAllByRole('switch');
    const wasOn = darkMode.getAttribute('aria-checked') === 'true';
    fireEvent.click(darkMode);
    expect(darkMode.getAttribute('aria-checked')).toBe(String(!wasOn));

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(darkMode.getAttribute('aria-checked')).toBe(String(wasOn));
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
});
