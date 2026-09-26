import { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase/client';

// ─── Types shared by the patient and doctor surfaces ─────────────────────────

export type ChatAttachmentKind = 'image' | 'document';

export interface ChatAttachment {
  /** Short-lived signed URL for rendering; null until resolved (or on failure). */
  url: string | null;
  name: string;
  kind: ChatAttachmentKind;
}

export interface ChatThreadSummary {
  otherId: string;
  lastText: string;
  lastSender: 'patient' | 'doctor' | null;
  lastAttachmentKind: ChatAttachmentKind | null;
  lastAttachmentName: string | null;
  lastAt: string;
  unreadCount: number;
}

export interface PickedAttachment {
  uri: string;
  name: string;
  mimeType: string;
  kind: ChatAttachmentKind;
}

export interface StoredAttachment {
  path: string;
  name: string;
  kind: ChatAttachmentKind;
}

const BUCKET = 'chat-attachments';
const SIGNED_URL_TTL_SECONDS = 3600;
const MAX_BYTES = 15 * 1024 * 1024; // mirrors the bucket limit

const IMAGE_MIME_PREFIX = 'image/';

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
};

const kindFromMimeOrName = (mimeType: string, name: string): ChatAttachmentKind => {
  if (mimeType.startsWith(IMAGE_MIME_PREFIX)) return 'image';
  const ext = extensionOf(name);
  return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'image' : 'document';
};

// ─── Picking ─────────────────────────────────────────────────────────────────

/** Photo library selection; returns null when the user cancels or denies access. */
export const pickImageAttachment = async (): Promise<PickedAttachment | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled) return null;

  const asset: ImagePickerAsset = result.assets[0];
  const name = asset.fileName || `photo_${Date.now()}.jpg`;
  const mimeType = asset.mimeType || 'image/jpeg';
  return { uri: asset.uri, name, mimeType, kind: 'image' };
};

/** Document selection (PDF/DOC/DOCX/TXT); returns null when cancelled. */
export const pickDocumentAttachment = async (): Promise<PickedAttachment | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/*',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const name = asset.name || `document_${Date.now()}`;
  const mimeType = asset.mimeType || 'application/octet-stream';
  return { uri: asset.uri, name, mimeType, kind: kindFromMimeOrName(mimeType, name) };
};

// ─── Upload / sign ───────────────────────────────────────────────────────────

const safeFileName = (name: string): string =>
  name.replace(/[^\w.\-]+/g, '_').replace(/_{2,}/g, '_').slice(-80) || 'attachment';

/**
 * Uploads a picked file into the private bucket under
 * `{patientId}/{clinicianId}/...` — the exact shape the storage RLS policy
 * checks. Either conversation participant may upload to the same folder.
 */
export const uploadChatAttachment = async (
  patientId: string,
  clinicianId: string,
  picked: PickedAttachment,
): Promise<StoredAttachment> => {
  const kind = picked.kind || kindFromMimeOrName(picked.mimeType, picked.name);

  // Size check before touching the network.
  const head = await fetch(picked.uri, { method: 'HEAD' }).catch(() => null);
  const length = Number(head?.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) {
    throw new Error('That file is larger than 15 MB. Please pick a smaller one.');
  }

  const path = `${patientId}/${clinicianId}/${Date.now()}_${safeFileName(picked.name)}`;
  const response = await fetch(picked.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: picked.mimeType,
    upsert: false,
  });
  if (error) throw new Error(error.message || 'The file could not be uploaded. Please try again.');

  return { path, name: picked.name, kind };
};

/** Mints a short-lived signed URL for a stored attachment path. */
export const signChatAttachment = async (path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
};

// ─── Row mapping ─────────────────────────────────────────────────────────────

export interface ChatMessageRow {
  id: string;
  sender: string;
  text: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_kind?: string | null;
  read_at?: string | null;
}

export const formatMessageTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

export const formatThreadTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const when = new Date(iso);
  const now = new Date();
  if (when.toDateString() === now.toDateString()) {
    return when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return when.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/** Client-side message shape shared by the patient and doctor surfaces. */
export interface ChatMessageBase {
  id: string;
  sender: 'patient' | 'doctor';
  text: string;
  timestamp: string;
  attachment: ChatAttachment | null;
  readAt: string | null;
}

/** Maps a chat_messages row into a client message, signing any attachment. */
export const mapChatRow = async (row: ChatMessageRow): Promise<ChatMessageBase> => {
  let attachment: ChatAttachment | null = null;
  if (row.attachment_url) {
    attachment = {
      url: await signChatAttachment(row.attachment_url),
      name: row.attachment_name || 'Attachment',
      kind: row.attachment_kind === 'image' ? 'image' : 'document',
    };
  }

  return {
    id: String(row.id),
    sender: row.sender === 'patient' ? 'patient' : 'doctor',
    text: row.text || '',
    timestamp: formatMessageTime(row.created_at),
    attachment,
    readAt: row.read_at ?? null,
  };
};

/** True when the message row carries only an attachment (no typed text). */
export const previewLabelFor = (
  text: string | null | undefined,
  attachmentKind: ChatAttachmentKind | null | undefined,
  attachmentName?: string | null,
): string => {
  const trimmed = (text || '').trim();
  if (trimmed) return trimmed;
  if (attachmentKind === 'image') return '📷 Photo';
  if (attachmentKind === 'document') return `📎 ${attachmentName || 'Document'}`;
  return 'No messages yet — say hello.';
};

// ─── Threads + read receipts ─────────────────────────────────────────────────

export const fetchChatThreads = async (): Promise<ChatThreadSummary[]> => {
  const { data, error } = await supabase.rpc('chat_threads');
  if (error) throw new Error(error.message);

  return ((data ?? []) as {
    other_id: string;
    last_text: string | null;
    last_sender: string | null;
    last_attachment_kind: string | null;
    last_attachment_name: string | null;
    last_at: string;
    unread_count: number;
  }[]).map((row) => ({
    otherId: String(row.other_id),
    lastText: row.last_text || '',
    lastSender: row.last_sender === 'patient' || row.last_sender === 'doctor' ? row.last_sender : null,
    lastAttachmentKind:
      row.last_attachment_kind === 'image' || row.last_attachment_kind === 'document'
        ? row.last_attachment_kind
        : null,
    lastAttachmentName: row.last_attachment_name ?? null,
    lastAt: row.last_at,
    unreadCount: Number(row.unread_count || 0),
  }));
};

/** Stamps every message received from `otherId` as read (best effort). */
export const markThreadRead = async (otherId: string): Promise<void> => {
  const { error } = await supabase.rpc('mark_chat_read', { p_other: otherId });
  void error; // receipts are cosmetic — never block the conversation
};
