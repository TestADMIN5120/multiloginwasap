import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Multi-account local store. Each account row:
 *   { id, phone, username, displayName, avatarUrl, token }
 *
 * Plus a single `activeId` pointer.
 */

async function readAccounts() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts) {
  await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
}

async function readActiveId() {
  return (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ID)) || null;
}

async function writeActiveId(id) {
  if (id) await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
  else await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
}

export async function loadState() {
  const [accounts, activeId] = await Promise.all([readAccounts(), readActiveId()]);
  let resolvedActive = activeId;
  if (resolvedActive && !accounts.find((a) => a.id === resolvedActive)) {
    resolvedActive = accounts[0]?.id || null;
  }
  return { accounts, activeId: resolvedActive };
}

export async function addAccount(account) {
  const accounts = await readAccounts();
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...account };
  else accounts.push(account);
  await writeAccounts(accounts);
  await writeActiveId(account.id);
  return accounts;
}

export async function updateAccount(id, patch) {
  const accounts = await readAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx < 0) return accounts;
  accounts[idx] = { ...accounts[idx], ...patch };
  await writeAccounts(accounts);
  return accounts;
}

export async function removeAccount(id) {
  const accounts = (await readAccounts()).filter((a) => a.id !== id);
  await writeAccounts(accounts);
  const active = await readActiveId();
  if (active === id) await writeActiveId(accounts[0]?.id || null);
  return accounts;
}

export async function setActive(id) {
  await writeActiveId(id);
}

export async function clearAll() {
  await AsyncStorage.multiRemove([STORAGE_KEYS.ACCOUNTS, STORAGE_KEYS.ACTIVE_ID]);
}

