/**
 * The user's own profile photo — web side of mobile's
 * src/services/avatarUpload.ts (same bucket, same file layout, same rules —
 * change both).
 *
 * The user frames the photo in a circle (components/AvatarCropDialog); the
 * square under it is shrunk to 512×512 JPEG in the browser before it leaves
 * (~60–150 KB), stored at `avatars/<uid>/<ms>.jpg` in
 * the public bucket (migration 20261116130000_avatars_bucket.sql). A fresh
 * name per upload means the URL changes, so no cache keeps the old face; the
 * user's older files are deleted after the profile points at the new one.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_SIZE = 512;
const JPEG_QUALITY = 0.8;
const DISCORD_PLACEHOLDER = '/embed/avatars/';

/** The photo the user's sign-in provider supplied, if any. */
export function providerPhotoFor(user: User | null): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const url = (meta.avatar_url || meta.picture || '').trim();
  if (!url || url.includes(DISCORD_PLACEHOLDER)) return null;
  return url;
}

/** "Google" / "Discord" for "Use my … photo"; null when it can't be named. */
export function providerLabelFor(user: User | null): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const url = meta.avatar_url || meta.picture || '';
  const app = (user?.app_metadata ?? {}) as { provider?: string; providers?: string[] };
  const providers = app.providers ?? (app.provider ? [app.provider] : []);
  if (/googleusercontent\.com/.test(url) || (providers.includes('google') && !providers.includes('discord'))) return 'Google';
  if (/discordapp\.(com|net)/.test(url) || providers.includes('discord')) return 'Discord';
  return null;
}

export function isUploadedAvatar(url: string | null | undefined): boolean {
  return !!url && url.includes(`/storage/v1/object/public/${AVATAR_BUCKET}/`);
}

export type AvatarAction = 'useProvider' | 'remove';

/** The one option offered beside "Choose a photo" (mirrors mobile). */
export function secondaryAvatarAction(currentUrl: string | null | undefined, providerUrl: string | null): AvatarAction | null {
  if (providerUrl && currentUrl !== providerUrl) return 'useProvider';
  if (currentUrl) return 'remove';
  return null;
}

/** Cut `rect` (source pixels) out of the photo and shrink it to a 512×512 JPEG blob. */
export async function cropToAvatar(
  file: Blob,
  rect: { originX: number; originY: number; width: number; height: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, rect.originX, rect.originY, rect.width, rect.height, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the photo'))), 'image/jpeg', JPEG_QUALITY));
  } finally {
    bitmap.close();
  }
}

/** Upload a resized avatar and return its public URL. */
export async function uploadAvatar(supabase: SupabaseClient, userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Delete the user's uploaded files except `keepUrl`. Best effort. */
export async function pruneOldAvatars(supabase: SupabaseClient, userId: string, keepUrl: string | null): Promise<void> {
  try {
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
    if (error || !data?.length) return;
    const keep = keepUrl ? keepUrl.split('/').pop() : null;
    const stale = data.map(f => f.name).filter(name => name !== keep).map(name => `${userId}/${name}`);
    if (stale.length) await supabase.storage.from(AVATAR_BUCKET).remove(stale);
  } catch (e) {
    console.warn('[avatar] cleanup failed:', e);
  }
}
