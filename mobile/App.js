import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AccountProvider } from './src/context/AccountContext';
import { SocketProvider } from './src/context/SocketContext';
import { CallProvider } from './src/context/CallContext';
import CallOverlay from './src/components/CallOverlay';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AccountProvider>
          <SocketProvider>
            <CallProvider>
              <NavigationContainer>
                <StatusBar style="light" />
                <RootNavigator />
                <CallOverlay />
              </NavigationContainer>
            </CallProvider>
          </SocketProvider>
        </AccountProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

