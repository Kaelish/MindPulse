import { formatPhoneNumber, parsePhoneNumber, validatePhoneNumber } from './internationalPhone';

it('accepts valid Philippine, US, and Australian national number lengths', () => {
  expect(validatePhoneNumber('+63 9874563210')).toBeNull();
  expect(validatePhoneNumber('+1 4155551234')).toBeNull();
  expect(validatePhoneNumber('+61 412345678')).toBeNull();
});

it('rejects country-specific length and invalid Philippine mobile prefixes', () => {
  expect(validatePhoneNumber('+63 987456321')).toMatch(/10 digits/);
  expect(validatePhoneNumber('+63 8123456789')).toMatch(/start with 9/);
});

it('normalizes existing Philippine local format into a +63 number', () => {
  const parsed = parsePhoneNumber('09171234567');
  expect(parsed.country.code).toBe('PH');
  expect(formatPhoneNumber(parsed.country, parsed.nationalNumber)).toBe('+63 9171234567');
});

it('rejects non-digit national numbers', () => {
  expect(validatePhoneNumber('+63 917-123-4567')).toMatch(/digits only/);
});