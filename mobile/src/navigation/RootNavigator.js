import React from 'react';
import { useAccount } from '../context/AccountContext';
import SplashScreen from '../screens/SplashScreen';
import AuthStack from './AuthStack';
import MainStack from './MainStack';

/**
 * The "do I have an active account?" gate.
 * - Not yet hydrated from AsyncStorage → splash
 * - No active account → AuthStack (phone/OTP/create)
 * - Active account → MainStack (chats etc.)
 *
 * Switching the active account does NOT remount this — only `accounts` state
 * goes from non-empty to empty (sign-out-all) or vice versa.
 */
export default function RootNavigator() {
  const { hydrated, activeAccount } = useAccount();

  if (!hydrated) return <SplashScreen />;
  if (!activeAccount) return <AuthStack />;
  return <MainStack />;
}

