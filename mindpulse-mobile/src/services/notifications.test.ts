/**
 * B-2 (notification dismiss): the soft-delete must be pinned to the signed-in
 * account. RLS already scopes `notifications_update` to the owner, but the
 * query repeats the filter so intent survives any future policy widening.
 */
import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { dismissNotification } from './notifications';

jest.mock('../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./session', () => ({ requireUserId: jest.fn() }));

/** Resolved payload of the last `.eq(...)` in the update chain. */
let updateResult: { error: { message: string } | null } = { error: null };

const eq: any = jest.fn(() => ({
  eq,
  then: (onFulfilled: any, onRejected: any) =>
    Promise.resolve(updateResult).then(onFulfilled, onRejected),
}));
const mockUpdate = jest.fn(() => ({ eq }));
const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  updateResult = { error: null };
  (requireUserId as jest.Mock).mockResolvedValue('user-1');
  mockFrom.mockReturnValue({ update: mockUpdate });
});

describe('dismissNotification', () => {
  it('soft-deletes the row pinned to the signed-in account', async () => {
    await dismissNotification('notif-9');

    expect(mockFrom).toHaveBeenCalledWith('notifications');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('id', 'notif-9');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('surfaces the database error instead of swallowing it', async () => {
    updateResult = { error: { message: 'permission denied for table notifications' } };

    await expect(dismissNotification('notif-9')).rejects.toThrow(
      'permission denied for table notifications',
    );
  });

  it('propagates a missing session rather than soft-deleting unauthenticated', async () => {
    (requireUserId as jest.Mock).mockRejectedValue(new Error('You must be signed in to do that.'));

    await expect(dismissNotification('notif-9')).rejects.toThrow('You must be signed in to do that.');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
