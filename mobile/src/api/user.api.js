import api, { useAccountAuth } from './client';

export const me = () => api.get('/users/me', useAccountAuth()).then((r) => r.data.account);

export const updateMe = (patch) =>
  api.patch('/users/me', patch, useAccountAuth()).then((r) => r.data.account);

export const search = (q) =>
  api.get('/users/search', { ...useAccountAuth(), params: { q } }).then((r) => r.data.results);

