import api, { useAccountAuth } from './client';

/**
 * Upload a local file (typically an Expo ImagePicker asset) to the backend
 * `POST /api/uploads` endpoint as `multipart/form-data` (field name `file`).
 *
 * The active-account JWT is injected automatically by the axios interceptor
 * in `client.js` because we pass `useAccountAuth()`'s `X-Auth-Mode` header.
 *
 * @param {{ uri: string, name?: string, mimeType?: string }} file
 * @returns {Promise<{ url: string, filename: string, size: number, mimeType: string }>}
 */
export async function uploadFile({ uri, name, mimeType }) {
  if (!uri) throw new Error('uri_required');

  // React Native's FormData accepts the {uri,name,type} shape natively — it
  // streams the file from disk without needing a Blob.
  const form = new FormData();
  form.append('file', {
    uri,
    name: name || 'upload',
    type: mimeType || 'application/octet-stream',
  });

  const res = await api.post('/uploads', form, {
    ...useAccountAuth(),
    headers: {
      // Spread to keep the X-Auth-Mode marker the interceptor consumes.
      ...useAccountAuth().headers,
      'Content-Type': 'multipart/form-data',
    },
    // Larger files: bump the per-request timeout above the 15s default.
    timeout: 60000,
  });

  return res.data;
}

