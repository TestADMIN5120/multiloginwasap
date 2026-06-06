import api, { useAccountAuth } from './client';

export const list = () =>
  api.get('/conversations', useAccountAuth()).then((r) => r.data.conversations);

export const create = (payload) =>
  api.post('/conversations', payload, useAccountAuth()).then((r) => r.data.conversation);

export const get = (id) =>
  api.get(`/conversations/${id}`, useAccountAuth()).then((r) => r.data.conversation);

