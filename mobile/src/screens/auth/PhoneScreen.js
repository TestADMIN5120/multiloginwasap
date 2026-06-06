import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { requestOtp, devLogin } from '../../api/auth.api';
import { useAccount } from '../../context/AccountContext';
import { COLORS } from '../../utils/constants';

const SKIP_OTP =
  !!(Constants?.expoConfig?.extra?.DEV_SKIP_OTP || Constants?.manifest?.extra?.DEV_SKIP_OTP);

const API_URL =
  Constants?.expoConfig?.extra?.API_URL ||
  Constants?.manifest?.extra?.API_URL ||
  '(not set)';

export default function PhoneScreen({ navigation }) {
  const [phone, setPhone] = useState('+');
  const [loading, setLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const { beginPhoneSession } = useAccount();

  const pingApi = async () => {
    setPingResult('Pinging...');
    try {
      const t0 = Date.now();
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${API_URL}/api/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      const text = await res.text();
      setPingResult(`OK ${res.status} (${Date.now() - t0}ms): ${text.slice(0, 60)}`);
    } catch (err) {
      setPingResult(`FAIL: ${err?.message || err}`);
    }
  };

  const handleSubmit = async () => {
    if (!phone || phone.length < 8) return Alert.alert('Invalid', 'Enter a valid phone number with country code');
    setLoading(true);
    try {
      if (SKIP_OTP) {
        const res = await devLogin(phone);
        beginPhoneSession({ phone: res.phone, phoneToken: res.phoneToken });
        if (res.accounts && res.accounts.length > 0) {
          navigation.replace('PickAccount', { accounts: res.accounts });
        } else {
          navigation.replace('CreateAccount', { phone: res.phone });
        }
      } else {
        const res = await requestOtp(phone);
        navigation.navigate('Otp', { phone: res.phone, devCode: res.devCode });
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>MultiTabWatsap</Text>
          <Text style={styles.subtitle}>Sign in with your phone number</Text>
          <Text style={styles.hint}>You can create multiple identities under the same number.</Text>
          {SKIP_OTP ? (
            <Text style={styles.devBadge}>⚠️ DEV mode — OTP step is skipped</Text>
          ) : null}

          {/* DEV-ONLY connectivity panel — strip when shipping. */}
          {__DEV__ && (
            <View style={styles.debugBox}>
              <Text style={styles.debugLabel}>API_URL</Text>
              <Text style={styles.debugValue} numberOfLines={2}>{API_URL}</Text>
              <TouchableOpacity style={styles.debugBtn} onPress={pingApi}>
                <Text style={styles.debugBtnText}>Test connection</Text>
              </TouchableOpacity>
              {pingResult ? (
                <Text style={[styles.debugResult, /FAIL/.test(pingResult) && { color: COLORS.danger }]}>
                  {pingResult}
                </Text>
              ) : null}
            </View>
          )}

          <Text style={styles.label}>Phone (with country code)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+15551234567"
            keyboardType="phone-pad"
            autoFocus
          />

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.btnText}>
              {loading ? (SKIP_OTP ? 'Signing in…' : 'Sending…') : (SKIP_OTP ? 'Continue' : 'Send OTP')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  subtitle: { fontSize: 16, color: COLORS.text, textAlign: 'center', marginTop: 8 },
  hint: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  devBadge: {
    textAlign: 'center', color: COLORS.danger, fontWeight: '700', marginBottom: 8, fontSize: 12,
  },
  debugBox: {
    backgroundColor: '#FFF8DC',
    borderColor: '#E0C870',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  debugLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700' },
  debugValue: { fontSize: 12, color: COLORS.text, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  debugBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  debugBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  debugResult: { fontSize: 11, marginTop: 6, color: COLORS.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  label: { color: COLORS.textMuted, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff',
    borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.text,
  },
  btn: {
    marginTop: 20, backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

