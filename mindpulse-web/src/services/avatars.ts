import { supabase } from '../supabase/client';

/**
 * Batch-loads `profiles.avatar_url` for a set of user ids so one party can
 * render the other party's photo (avatars used to live only in auth metadata,
 * readable solely by the owner — migration 0017 adds the column).
 *
 * Deliberately failure-proof: if the column does not exist yet (migration not
 * applied), the caller lacks RLS visibility of a row, or Supabase is offline,
 * it returns a partial/empty map instead of throwing — avatars are progressive
 * enhancement and must never break a list that already loaded.
 */
export const fetchAvatarUrls = async (userIds: readonly (string | null | undefined)[]): Promise<Map<string, string>> => {
  const avatars = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (!supabase || ids.length === 0) return avatars;
  try {
    const { data, error } = await supabase.from('profiles').select('id, avatar_url').in('id', ids);
    if (error || !data) return avatars;
    (data as { id: string; avatar_url: string | null }[]).forEach((row) => {
      if (row.avatar_url) avatars.set(row.id, row.avatar_url);
    });
  } catch {
    // Missing column / offline — keep showing initials.
  }
  return avatars;
};
