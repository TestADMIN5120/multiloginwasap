import api, { useAccountAuth } from './client';

export const listMessages = (conversationId, params = {}) =>
  api
    .get(`/conversations/${conversationId}/messages`, { ...useAccountAuth(), params })
    .then((r) => r.data.messages);

export const sendMessage = (conversationId, payload) =>
  api
    .post(`/conversations/${conversationId}/messages`, payload, useAccountAuth())
    .then((r) => r.data.message);

export const markRead = (messageId) =>
  api.post(`/messages/${messageId}/read`, {}, useAccountAuth()).then((r) => r.data);

