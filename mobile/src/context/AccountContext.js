import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as storage from '../storage/accountStorage';
import { setAccountTokenProvider, setPhoneTokenProvider } from '../api/client';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [phoneToken, setPhoneToken] = useState(null);
  const [pendingPhone, setPendingPhone] = useState(null); // for the auth flow
  const [hydrated, setHydrated] = useState(false);

  // Use refs to provide live tokens to the axios client without re-creating axios.
  const phoneTokenRef = useRef(null);
  const activeAccountRef = useRef(null);

  // Wire token providers once
  useEffect(() => {
    setAccountTokenProvider(() => activeAccountRef.current?.token || null);
    setPhoneTokenProvider(() => phoneTokenRef.current || null);
  }, []);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      const { accounts: a, activeId: id } = await storage.loadState();
      setAccounts(a);
      setActiveId(id);
      setHydrated(true);
    })();
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeId) || null,
    [accounts, activeId]
  );

  // Keep refs in sync
  useEffect(() => {
    activeAccountRef.current = activeAccount;
  }, [activeAccount]);

  useEffect(() => {
    phoneTokenRef.current = phoneToken;
  }, [phoneToken]);

  /* ---- Auth flow helpers ---- */

  const beginPhoneSession = useCallback(({ phone, phoneToken: pt }) => {
    setPendingPhone(phone);
    setPhoneToken(pt);
  }, []);

  const endPhoneSession = useCallback(() => {
    setPendingPhone(null);
    setPhoneToken(null);
  }, []);

  /* ---- Account CRUD ---- */

  const addAccount = useCallback(async ({ account, accountToken }) => {
    const row = {
      id: account.id,
      phone: account.phone,
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl || null,
      about: account.about || '',
      token: accountToken,
    };
    const next = await storage.addAccount(row);
    setAccounts(next);
    setActiveId(row.id);
    return row;
  }, []);

  const switchTo = useCallback(async (id) => {
    if (!id) return;
    await storage.setActive(id);
    setActiveId(id);
  }, []);

  const updateActiveAccount = useCallback(async (patch) => {
    if (!activeId) return;
    const next = await storage.updateAccount(activeId, patch);
    setAccounts(next);
  }, [activeId]);

  const signOutAccount = useCallback(async (id) => {
    const target = id || activeId;
    if (!target) return;
    const next = await storage.removeAccount(target);
    setAccounts(next);
    setActiveId(next[0]?.id || null);
  }, [activeId]);

  const signOutAll = useCallback(async () => {
    await storage.clearAll();
    setAccounts([]);
    setActiveId(null);
    setPendingPhone(null);
    setPhoneToken(null);
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      accounts,
      activeId,
      activeAccount,
      pendingPhone,
      phoneToken,
      beginPhoneSession,
      endPhoneSession,
      addAccount,
      switchTo,
      updateActiveAccount,
      signOutAccount,
      signOutAll,
    }),
    [
      hydrated,
      accounts,
      activeId,
      activeAccount,
      pendingPhone,
      phoneToken,
      beginPhoneSession,
      endPhoneSession,
      addAccount,
      switchTo,
      updateActiveAccount,
      signOutAccount,
      signOutAll,
    ]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}

