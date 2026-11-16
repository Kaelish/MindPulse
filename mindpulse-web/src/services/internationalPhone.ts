export interface PhoneCountry {
  code: string;
  label: string;
  callingCode: string;
  nationalDigits: number[];
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'PH', label: 'Philippines', callingCode: '+63', nationalDigits: [10] },
  { code: 'US', label: 'United States', callingCode: '+1', nationalDigits: [10] },
  { code: 'GB', label: 'United Kingdom', callingCode: '+44', nationalDigits: [10] },
  { code: 'IN', label: 'India', callingCode: '+91', nationalDigits: [10] },
  { code: 'AU', label: 'Australia', callingCode: '+61', nationalDigits: [9] },
  { code: 'SG', label: 'Singapore', callingCode: '+65', nationalDigits: [8] },
  { code: 'JP', label: 'Japan', callingCode: '+81', nationalDigits: [10] },
  { code: 'AE', label: 'United Arab Emirates', callingCode: '+971', nationalDigits: [9] },
  { code: 'FR', label: 'France', callingCode: '+33', nationalDigits: [9] },
  { code: 'DE', label: 'Germany', callingCode: '+49', nationalDigits: [10, 11] },
];

export interface ParsedPhoneNumber {
  country: PhoneCountry;
  nationalNumber: string;
}

export const parsePhoneNumber = (value: string | null | undefined): ParsedPhoneNumber => {
  const phone = (value ?? '').trim();
  if (!phone) return { country: PHONE_COUNTRIES[0], nationalNumber: '' };

  const country = PHONE_COUNTRIES
    .filter((entry) => phone.startsWith(entry.callingCode))
    .sort((left, right) => right.callingCode.length - left.callingCode.length)[0];
  if (country) {
    return {
      country,
      nationalNumber: phone.slice(country.callingCode.length).replace(/\s/g, ''),
    };
  }

  const digits = phone.replace(/\s/g, '');
  const phNumber = digits.startsWith('0') ? digits.slice(1) : digits;
  return { country: PHONE_COUNTRIES[0], nationalNumber: phNumber };
};

export const formatPhoneNumber = (country: PhoneCountry, nationalNumber: string): string => {
  const trimmedNumber = nationalNumber.trim();
  return trimmedNumber ? `${country.callingCode} ${trimmedNumber}` : '';
};

export const normalizePhoneNumber = (value: string | null | undefined): string => {
  const compactPhone = (value ?? '').replace(/[^\d+]/g, '');
  if (compactPhone.startsWith('+') && !PHONE_COUNTRIES.some((country) => compactPhone.startsWith(country.callingCode))) {
    return compactPhone;
  }
  const parsed = parsePhoneNumber(value);
  return parsed.nationalNumber ? `${parsed.country.callingCode}${parsed.nationalNumber}` : '';
};

export const validatePhoneNumber = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;
  const compactPhone = value.replace(/[^\d+]/g, '');
  if (compactPhone.startsWith('+') && !PHONE_COUNTRIES.some((country) => compactPhone.startsWith(country.callingCode))) {
    return 'This country code is not supported. Select a supported country code.';
  }
  const { country, nationalNumber } = parsePhoneNumber(value);
  if (!/^\d+$/.test(nationalNumber)) return 'Phone number must contain digits only.';
  if (!country.nationalDigits.includes(nationalNumber.length)) {
    const counts = country.nationalDigits.join(' or ');
    return `${country.label} numbers must have ${counts} digits after ${country.callingCode}.`;
  }
  if (country.code === 'PH' && !/^9\d{9}$/.test(nationalNumber)) {
    return 'Philippine mobile numbers must start with 9 and contain 10 digits after +63.';
  }
  return null;
};