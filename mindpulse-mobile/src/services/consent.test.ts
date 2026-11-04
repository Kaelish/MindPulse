/**
 * B-3 (face-scan consent): the write must be pinned to the signed-in account,
 * idempotent (the privacy sheet opens before every scan), and honest about
 * failures — a scan must not start while its proof is missing.
 */
import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { recordFaceScanConsent } from './consent';

jest.mock('../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./session', () => ({ requireUserId: jest.fn() }));

let selectResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let insertResult: { error: { message: string } | null } = { error: null };

const limit = jest.fn(() => Promise.resolve(selectResult));
const eq = jest.fn(() => ({ eq, limit }));
const select = jest.fn(() => ({ eq }));
const insert = jest.fn(() => Promise.resolve(insertResult));
const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (requireUserId as jest.Mock).mockResolvedValue('user-1');
  selectResult = { data: [], error: null };
  insertResult = { error: null };
  mockFrom.mockReturnValue({ select, insert });
});

describe('recordFaceScanConsent', () => {
  it('files a new proof for the signed-in account', async () => {
    await expect(recordFaceScanConsent()).resolves.toBe(true);

    expect(mockFrom).toHaveBeenCalledWith('consent_records');
    expect(select).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eq).toHaveBeenCalledWith('consent_type', 'face_scan');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      consent_type: 'face_scan',
      version: '1.0',
      source: 'mobile_face_scan',
    });
  });

  it('does not file a second proof when one is already on file', async () => {
    selectResult = { data: [{ id: 'consent-1' }], error: null };

    await expect(recordFaceScanConsent()).resolves.toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('surfaces a read failure instead of filing a duplicate', async () => {
    selectResult = { data: null, error: { message: 'permission denied for table consent_records' } };

    await expect(recordFaceScanConsent()).rejects.toThrow(
      'permission denied for table consent_records',
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('surfaces the write failure so the sheet can stay open', async () => {
    insertResult = { error: { message: 'new row violates row-level security policy' } };

    await expect(recordFaceScanConsent()).rejects.toThrow(
      'new row violates row-level security policy',
    );
  });

  it('propagates a missing session rather than consenting anonymously', async () => {
    (requireUserId as jest.Mock).mockRejectedValue(new Error('You must be signed in to do that.'));

    await expect(recordFaceScanConsent()).rejects.toThrow('You must be signed in to do that.');
    expect(select).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
