import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChatListScreen from '../screens/chats/ChatListScreen';
import ChatScreen from '../screens/chats/ChatScreen';
import ContactsScreen from '../screens/contacts/ContactsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import AddAccountScreen from '../screens/settings/AddAccountScreen';
import CallHistoryScreen from '../screens/calls/CallHistoryScreen';

const Stack = createNativeStackNavigator();

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Contacts" component={ContactsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
    </Stack.Navigator>
  );
}

