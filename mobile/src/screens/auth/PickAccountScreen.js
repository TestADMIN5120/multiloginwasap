import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '../../context/AccountContext';
import { loginToAccount } from '../../api/account.api';
import Avatar from '../../components/Avatar';
import { COLORS } from '../../utils/constants';

/**
 * Shown after OTP verification when the phone already has accounts.
 * The user picks one to log into, OR creates a new identity.
 */
export default function PickAccountScreen({ route, navigation }) {
  const { accounts: existing } = route.params || { accounts: [] };
  const { addAccount, endPhoneSession } = useAccount();

  const handlePick = async (acc) => {
    try {
      const res = await loginToAccount(acc.id); // { account, accountToken }
      await addAccount(res);
      endPhoneSession();
    } catch (err) {
      Alert.alert('Login failed', err.message || 'Unable to log in');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Pick an account</Text>
        <Text style={styles.subtitle}>This number has {existing.length} identity{existing.length === 1 ? '' : 'ies'}.</Text>
      </View>
      <FlatList
        data={existing}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => handlePick(item)}>
            <Avatar name={item.displayName || item.username} size={42} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.user}>@{item.username}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.replace('CreateAccount', { phone: existing[0]?.phone })}
      >
        <Text style={styles.addText}>＋  Create another identity</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  subtitle: { color: COLORS.textMuted, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  user: { color: COLORS.textMuted, marginTop: 2 },
  chev: { color: COLORS.textMuted, fontSize: 22 },
  addBtn: { padding: 16, alignItems: 'center', backgroundColor: COLORS.primaryLight },
  addText: { color: '#fff', fontWeight: '700' },
});

