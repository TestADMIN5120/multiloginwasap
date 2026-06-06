import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAccount } from '../../api/account.api';
import { useAccount } from '../../context/AccountContext';
import { COLORS } from '../../utils/constants';

export default function CreateAccountScreen({ route }) {
  const { phone } = route.params || {};
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { addAccount, endPhoneSession } = useAccount();

  const handleSubmit = async () => {
    if (!displayName.trim()) return Alert.alert('Required', 'Display name is required');
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username)) {
      return Alert.alert('Invalid username', 'Use 3–20 chars: letters, numbers, _ or .');
    }
    setLoading(true);
    try {
      const res = await createAccount({ displayName: displayName.trim(), username: username.toLowerCase() });
      // res = { account, accountToken }
      await addAccount(res);
      endPhoneSession();
      // Root navigator will switch to MainStack automatically once an active account exists
    } catch (err) {
      const msg = err.message === 'username_taken' ? 'That username is already taken.' : (err.message || 'Failed');
      Alert.alert('Could not create', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Create your identity</Text>
          <Text style={styles.subtitle}>For phone {phone}</Text>
          <Text style={styles.hint}>You can add more identities later from settings.</Text>

          <Text style={styles.label}>Display name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="John Doe" />

          <Text style={[styles.label, { marginTop: 16 }]}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            placeholder="johndoe"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Creating…' : 'Create account'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  subtitle: { color: COLORS.textMuted, textAlign: 'center', marginTop: 4 },
  hint: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 22 },
  label: { color: COLORS.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff',
    borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.text,
  },
  btn: { marginTop: 24, backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

