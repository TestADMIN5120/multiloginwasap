import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyOtp } from '../../api/auth.api';
import { useAccount } from '../../context/AccountContext';
import { COLORS } from '../../utils/constants';

export default function OtpScreen({ route, navigation }) {
  const { phone, devCode } = route.params || {};
  const [code, setCode] = useState(devCode || '');
  const [loading, setLoading] = useState(false);
  const { beginPhoneSession } = useAccount();

  const handleVerify = async () => {
    if (!code || code.length < 4) return Alert.alert('Invalid', 'Enter the OTP code');
    setLoading(true);
    try {
      const res = await verifyOtp(phone, code);
      // Open phone session — required to list/create accounts
      beginPhoneSession({ phone: res.phone, phoneToken: res.phoneToken });

      if (res.accounts && res.accounts.length > 0) {
        // Phone already has accounts — show picker
        navigation.replace('PickAccount', { accounts: res.accounts });
      } else {
        // First time — create initial identity
        navigation.replace('CreateAccount', { phone: res.phone });
      }
    } catch (err) {
      Alert.alert('Verification failed', err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>We sent a code to {phone}</Text>
          {devCode ? (
            <Text style={styles.devHint}>(dev mode: code is {devCode})</Text>
          ) : null}

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoFocus
            maxLength={6}
          />

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleVerify} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: COLORS.primaryLight }}>Use a different number</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  subtitle: { color: COLORS.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 8 },
  devHint: { textAlign: 'center', color: COLORS.accent, marginBottom: 16 },
  input: {
    marginTop: 12,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff',
    borderRadius: 8, padding: 14, fontSize: 22, textAlign: 'center', letterSpacing: 8, color: COLORS.text,
  },
  btn: { marginTop: 20, backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

