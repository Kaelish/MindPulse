import React, { useEffect, useState } from 'react';
import {
  formatPhoneNumber,
  parsePhoneNumber,
  PHONE_COUNTRIES,
  PhoneCountry,
} from '../services/internationalPhone';
import './InternationalPhoneField.css';

interface InternationalPhoneFieldProps {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
}

export const InternationalPhoneField: React.FC<InternationalPhoneFieldProps> = ({ label, value, editing, onChange }) => {
  const parsed = parsePhoneNumber(value);
  const [country, setCountry] = useState<PhoneCountry>(parsed.country);
  const inputId = `phone-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    if (value.trim()) setCountry(parsePhoneNumber(value).country);
  }, [value]);

  const updateCountry = (code: string) => {
    const selected = PHONE_COUNTRIES.find((option) => option.code === code) ?? PHONE_COUNTRIES[0];
    setCountry(selected);
    onChange(formatPhoneNumber(selected, parsed.nationalNumber));
  };

  const updateNationalNumber = (nationalNumber: string) => {
    onChange(formatPhoneNumber(country, nationalNumber));
  };

  return (
    <div className="international-phone-field">
      <label htmlFor={inputId}>{label}</label>
      <div className={`international-phone-control ${editing ? 'is-editable' : ''}`}>
        <select
          aria-label={`${label} country`}
          value={country.code}
          disabled={!editing}
          onChange={(event) => updateCountry(event.target.value)}
        >
          {PHONE_COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>{option.code} {option.callingCode}</option>
          ))}
        </select>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={15}
          value={parsed.nationalNumber}
          placeholder={country.code === 'PH' ? '9874563210' : 'National number'}
          readOnly={!editing}
          onChange={(event) => updateNationalNumber(event.target.value)}
        />
      </div>
    </div>
  );
};