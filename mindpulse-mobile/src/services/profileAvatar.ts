import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase/client';
import { requireUserId } from './session';

const PROFILE_PHOTOS_BUCKET = 'profile-photos';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export interface PickedPhoto {
  uri: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Current avatar URL, stored in auth user metadata exactly like the web app
 * (avatar_url / avatar_bucket / avatar_path written by uploadProfilePhoto).
 * Returns null when the student has never set a photo.
 */
export const getAvatarUrl = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    return typeof meta.avatar_url === 'string' && meta.avatar_url ? meta.avatar_url : null;
  } catch {
    return null;
  }
};

/** Opens the device gallery cropped to a square; null when the user cancels. */
export const pickProfilePhoto = async (): Promise<PickedPhoto | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is needed to change your profile picture.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileSize: asset.fileSize ?? 0,
  };
};

/**
 * Uploads to the public profile-photos bucket (folder = user id, matching the
 * RLS policies from migration 0009) and saves the cache-busted URL to auth
 * metadata — same contract as the web profileAvatar service.
 *
 * The file is sent as an ArrayBuffer (Supabase's documented React Native
 * pattern): a FormData file part can silently store an empty object, which
 * yields a "successful" upload that renders nothing. The URL is HEAD-probed
 * as an image before the metadata is saved, so a bad upload surfaces as an
 * error instead of an invisible avatar.
 */
export const uploadProfilePhoto = async (photo: PickedPhoto): Promise<string> => {
  if (!ALLOWED_IMAGE_TYPES.includes(photo.mimeType)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (photo.fileSize > MAX_BYTES) {
    throw new Error('Profile photos must be 5 MB or smaller.');
  }
  const userId = await requireUserId();
  const extension = photo.mimeType === 'image/png' ? 'png' : photo.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar.${extension}`;

  const fileResponse = await fetch(photo.uri);
  if (!fileResponse.ok) {
    throw new Error('Could not read the selected photo. Please try a different image.');
  }
  const arrayBuffer = await fileResponse.arrayBuffer();

  const { error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).upload(
    path,
    arrayBuffer,
    { contentType: photo.mimeType, upsert: true },
  );
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?updated=${Date.now()}`;

  // Verify the uploaded object really comes back as a non-empty image.
  try {
    const probe = await fetch(avatarUrl, { method: 'HEAD' });
    if (!probe.ok) throw new Error(`status ${probe.status}`);
    const contentType = probe.headers.get('content-type') ?? '';
    if (contentType && !contentType.startsWith('image/')) throw new Error(contentType);
    const length = probe.headers.get('content-length');
    if (length !== null && Number(length) === 0) throw new Error('empty file');
  } catch {
    throw new Error('The photo upload could not be verified. Please try again.');
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl, avatar_bucket: PROFILE_PHOTOS_BUCKET, avatar_path: path },
  });
  if (metadataError) throw new Error(metadataError.message);

  return avatarUrl;
};
