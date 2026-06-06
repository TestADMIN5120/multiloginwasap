import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { requestOtp, verifyOtp, devLogin } from '../../api/auth.api';
import { listAccounts, loginToAccount, createAccount } from '../../api/account.api';
import { useAccount } from '../../context/AccountContext';
import { COLORS } from '../../utils/constants';

const SKIP_OTP =
  !!(Constants?.expoConfig?.extra?.DEV_SKIP_OTP || Constants?.manifest?.extra?.DEV_SKIP_OTP);

/**
 * Add another identity to the same install. Same OTP flow as initial signup,
 * but reachable while already signed-in. Result is a new account row in
 * AsyncStorage; the active account auto-switches to the newly added one.
 */
export default function AddAccountScreen({ navigation }) {
  const { beginPhoneSession, endPhoneSession, addAccount } = useAccount();

  const [step, setStep] = useState('phone'); // phone → otp → choose
  const [phone, setPhone] = useState('+');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [existing, setExisting] = useState([]);
  const [phoneTok, setPhoneTok] = useState(null);
  const [busy, setBusy] = useState(false);

  // step 1
  const sendOtp = async () => {
    if (phone.length < 8) return Alert.alert('Invalid', 'Enter a phone number');
    setBusy(true);
    try {
      if (SKIP_OTP) {
        // Dev bypass — go straight from phone → choose without an OTP step.
        const r = await devLogin(phone);
        setPhone(r.phone);
        setPhoneTok(r.phoneToken);
        setExisting(r.accounts || []);
        beginPhoneSession({ phone: r.phone, phoneToken: r.phoneToken });
        setStep('choose');
      } else {
        const r = await requestOtp(phone);
        setPhone(r.phone);
        setDevCode(r.devCode || null);
        setCode(r.devCode || '');
        setStep('otp');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to sign in');
    } finally {
      setBusy(false);
    }
  };

  // step 2
  const doVerify = async () => {
    if (!code) return Alert.alert('Required', 'Enter the code');
    setBusy(true);
    try {
      const r = await verifyOtp(phone, code);
      setPhoneTok(r.phoneToken);
      setExisting(r.accounts || []);
      // Open phone session so account-creation API works
      beginPhoneSession({ phone: r.phone, phoneToken: r.phoneToken });
      setStep('choose');
    } catch (err) {
      Alert.alert('Verification failed', err.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  // step 3a — pick an existing account on this phone
  const pickExisting = async (acc) => {
    setBusy(true);
    try {
      const r = await loginToAccount(acc.id);
      await addAccount(r);
      endPhoneSession();
      navigation.popToTop();
    } catch (err) {
      Alert.alert('Could not log in', err.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  // step 3b — create a brand new identity on this phone
  const [newDisplay, setNewDisplay] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const createNew = async () => {
    if (!newDisplay.trim()) return Alert.alert('Required', 'Display name');
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(newUsername)) return Alert.alert('Invalid username', '3–20 chars');
    setBusy(true);
    try {
      const r = await createAccount({ displayName: newDisplay.trim(), username: newUsername.toLowerCase() });
      await addAccount(r);
      endPhoneSession();
      navigation.popToTop();
    } catch (err) {
      const msg = err.message === 'username_taken' ? 'Username taken' : (err.message || 'Failed');
      Alert.alert('Could not create', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add account</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          {step === 'phone' && (
            <>
              <Text style={styles.label}>Phone number (with country code)</Text>
              {SKIP_OTP ? (
                <Text style={styles.devHint}>⚠️ DEV mode — OTP step is skipped</Text>
              ) : null}
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={sendOtp} disabled={busy}>
                <Text style={styles.btnText}>
                  {busy ? (SKIP_OTP ? 'Signing in…' : 'Sending…') : (SKIP_OTP ? 'Continue' : 'Send OTP')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.label}>Enter the OTP sent to {phone}</Text>
              {devCode ? <Text style={styles.devHint}>(dev: {devCode})</Text> : null}
              <TextInput
                style={[styles.input, { textAlign: 'center', letterSpacing: 8 }]}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={doVerify} disabled={busy}>
                <Text style={styles.btnText}>{busy ? 'Verifying…' : 'Verify'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep('phone')} style={{ alignItems: 'center', marginTop: 14 }}>
                <Text style={{ color: COLORS.primaryLight }}>Change number</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'choose' && (
            <>
              {existing.length > 0 && (
                <>
                  <Text style={styles.section}>Existing identities on {phone}</Text>
                  {existing.map((a) => (
                    <TouchableOpacity key={a.id} style={styles.row} onPress={() => pickExisting(a)} disabled={busy}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{a.displayName}</Text>
                        <Text style={styles.rowSub}>@{a.username}</Text>
                      </View>
                      <Text style={{ color: COLORS.primaryLight, fontWeight: '700' }}>Use</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.divider} />
                </>
              )}

              <Text style={styles.section}>Create a new identity</Text>
              <TextInput style={styles.input} placeholder="Display name" value={newDisplay} onChangeText={setNewDisplay} />
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="username"
                value={newUsername}
                onChangeText={(v) => setNewUsername(v.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={createNew} disabled={busy}>
                <Text style={styles.btnText}>{busy ? 'Creating…' : 'Create new identity'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: COLORS.primary, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { color: '#fff', fontSize: 28, paddingHorizontal: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { padding: 18 },
  label: { color: COLORS.textMuted, marginBottom: 6 },
  devHint: { color: COLORS.accent, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff',
    borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.text,
  },
  btn: { marginTop: 16, backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  section: { fontWeight: '700', color: COLORS.text, marginBottom: 8, marginTop: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, backgroundColor: '#F2F4F5', borderRadius: 8, marginBottom: 8,
  },
  rowTitle: { fontWeight: '600', color: COLORS.text },
  rowSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
});

