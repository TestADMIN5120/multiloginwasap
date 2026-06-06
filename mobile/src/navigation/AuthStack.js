import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PhoneScreen from '../screens/auth/PhoneScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import CreateAccountScreen from '../screens/auth/CreateAccountScreen';
import PickAccountScreen from '../screens/auth/PickAccountScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="PickAccount" component={PickAccountScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
    </Stack.Navigator>
  );
}

