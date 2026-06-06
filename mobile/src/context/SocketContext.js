import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Constants from 'expo-constants';
import { useAccount } from './AccountContext';

const SOCKET_URL =
  Constants?.expoConfig?.extra?.SOCKET_URL ||
  Constants?.manifest?.extra?.SOCKET_URL ||
  'http://localhost:4000';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { activeAccount } = useAccount();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Tear down any previous socket on account change / sign out
    if (socketRef.current) {
      try {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch {}
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }

    if (!activeAccount?.token) return undefined;

    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token: activeAccount.token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 15000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.log('[socket] connect_error', err?.message);
      setConnected(false);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      try {
        s.removeAllListeners();
        s.disconnect();
      } catch {}
    };
  }, [activeAccount?.id, activeAccount?.token]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider');
  return ctx;
}

