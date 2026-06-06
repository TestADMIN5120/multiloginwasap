import api, { usePhoneAuth, useAccountAuth } from './client';

export const listAccounts = () =>
  api.get('/accounts', usePhoneAuth()).then((r) => r.data.accounts);

export const createAccount = (payload) =>
  api.post('/accounts', payload, usePhoneAuth()).then((r) => r.data);

export const loginToAccount = (accountId) =>
  api.post(`/accounts/${accountId}/login`, {}, usePhoneAuth()).then((r) => r.data);

export const deleteAccount = (accountId) =>
  api.delete(`/accounts/${accountId}`, useAccountAuth()).then((r) => r.data);

