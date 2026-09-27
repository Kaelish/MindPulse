import { supabase } from '../supabase/client';
import { requireUserId } from './session';

const PROFILE_PHOTOS_BUCKET = 'profile-photos';
const EXISTING_PRIVATE_BUCKET = 'chat-attachments';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

const isMissingBucket = (error: { message?: string } | null): boolean =>
  Boolean(error?.message?.toLowerCase().includes('bucket not found'));

export const resolveProfileAvatarUrl = async (
  metadata: Record<string, unknown> | null | undefined,
): Promise<string | null> => {
  if (!supabase || !metadata) return null;
  const bucket = typeof metadata.avatar_bucket === 'string' ? metadata.avatar_bucket : null;
  const path = typeof metadata.avatar_path === 'string' ? metadata.avatar_path : null;
  if (bucket && path) {
    const storage = supabase.storage.from(bucket);
    if (bucket === PROFILE_PHOTOS_BUCKET) return storage.getPublicUrl(path).data.publicUrl;
    const { data, error } = await storage.createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null;
};

export const uploadProfileAvatar = async (file: File): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Profile photos must be 5 MB or smaller.');
  }

  const userId = await requireUserId();
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar.${extension}`;
  let bucket = PROFILE_PHOTOS_BUCKET;
  let { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (isMissingBucket(uploadError)) {
    bucket = EXISTING_PRIVATE_BUCKET;
    ({ error: uploadError } = await supabase.storage
      .from(EXISTING_PRIVATE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true }));
  }
  if (uploadError) throw new Error(uploadError.message);

  let avatarUrl: string;
  if (bucket === PROFILE_PHOTOS_BUCKET) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    avatarUrl = `${data.publicUrl}?updated=${Date.now()}`;
  } else {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'The uploaded photo URL could not be created.');
    avatarUrl = data.signedUrl;
  }
  const { error: metadataError } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl, avatar_bucket: bucket, avatar_path: path },
  });
  if (metadataError) throw new Error(metadataError.message);

  window.localStorage.setItem('mindpulse.profileAvatarUrl', avatarUrl);
  window.dispatchEvent(new CustomEvent('mindpulse:avatar-updated', { detail: { avatarUrl } }));
  return avatarUrl;
};

export const notifyAvatarChanged = (avatarUrl: string | null): void => {
  if (typeof window === 'undefined') return;
  if (avatarUrl) window.localStorage.setItem('mindpulse.profileAvatarUrl', avatarUrl);
  else window.localStorage.removeItem('mindpulse.profileAvatarUrl');
  window.dispatchEvent(new CustomEvent('mindpulse:avatar-updated', { detail: { avatarUrl } }));
};