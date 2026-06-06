import { API_BASE } from '../api/client';

/**
 * The backend returns relative paths like `/uploads/<file>`. The mobile app
 * runs on a phone that can't resolve those by itself, so we prefix the API
 * host. Absolute URLs (http/https) are returned unchanged so future S3 / CDN
 * URLs Just Work.
 */
export function resolveMediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(API_BASE || '').replace(/\/+$/, '');
  const path = String(url).startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

/**
 * Best-effort filename + mime guess from an Expo ImagePicker asset URI.
 * Expo gives us `fileName` and `mimeType` on most platforms, but on some
 * Android paths they come through as null.
 */
export function inferFileMeta(asset = {}) {
  const uri = asset.uri || '';
  const fromUri = uri.split('/').pop() || 'upload';
  const ext = (fromUri.match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase();
  const guessedMime =
    ext === 'png' ? 'image/png'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : ext === 'heic' ? 'image/heic'
    : 'application/octet-stream';
  return {
    name: asset.fileName || fromUri,
    mimeType: asset.mimeType || guessedMime,
  };
}

