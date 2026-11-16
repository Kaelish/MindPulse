import { normalizePhoneNumber, validatePhoneNumber } from './internationalPhone';

it('validates international phone lengths against their country calling code', () => {
  expect(validatePhoneNumber('+63 9171234567')).toBeNull();
  expect(validatePhoneNumber('+1 4155551234')).toBeNull();
  expect(validatePhoneNumber('+61 412345678')).toBeNull();
  expect(validatePhoneNumber('+63 917123456')).toMatch(/10 digits/);
  expect(validatePhoneNumber('+63 8123456789')).toMatch(/start with 9/);
  expect(validatePhoneNumber('+61 41234567')).toMatch(/9 digits/);
  expect(validatePhoneNumber('+999 12345678')).toMatch(/country code is not supported/i);
});

it('normalizes local Philippine numbers and international formats', () => {
  expect(normalizePhoneNumber('09171234567')).toBe('+639171234567');
  expect(normalizePhoneNumber('+61 412345678')).toBe('+61412345678');
  expect(normalizePhoneNumber('+999 12345678')).toBe('+99912345678');
});
