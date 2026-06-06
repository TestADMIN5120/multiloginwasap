import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '../../context/AccountContext';
import Avatar from '../../components/Avatar';
import { COLORS } from '../../utils/constants';

export default function SettingsScreen({ navigation }) {
  const { accounts, activeId, activeAccount, switchTo, signOutAccount, signOutAll } = useAccount();

  const confirmSignOut = (id) => {
    Alert.alert('Sign out', 'Remove this account from this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOutAccount(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.profileCard}>
          <Avatar name={activeAccount?.displayName || activeAccount?.username || '?'} size={56} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={styles.profileName}>{activeAccount?.displayName}</Text>
            <Text style={styles.profileSub}>@{activeAccount?.username} · {activeAccount?.phone}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Accounts on this device</Text>
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => {
          const active = item.id === activeId;
          return (
            <View style={styles.row}>
              <TouchableOpacity style={styles.rowMain} onPress={() => switchTo(item.id)}>
                <Avatar name={item.displayName || item.username} size={38} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.rowName}>{item.displayName}</Text>
                  <Text style={styles.rowSub}>@{item.username} · {item.phone}</Text>
                </View>
                {active ? <Text style={styles.activeMark}>● active</Text> : null}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmSignOut(item.id)} style={styles.signOutBtn}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.addRow} onPress={() => navigation.navigate('AddAccount')}>
        <Text style={styles.addText}>＋  Add another account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.dangerRow}
        onPress={() =>
          Alert.alert('Sign out all', 'Remove every account from this device?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out all', style: 'destructive', onPress: signOutAll },
          ])
        }
      >
        <Text style={styles.dangerText}>Sign out of all accounts</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: COLORS.primary, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { color: '#fff', fontSize: 28, paddingHorizontal: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  section: { padding: 16 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, backgroundColor: '#F2F4F5', borderRadius: 12,
  },
  profileName: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  profileSub: { color: COLORS.textMuted, marginTop: 2 },
  sectionLabel: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
    color: COLORS.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  activeMark: { color: COLORS.accent, marginLeft: 8, fontWeight: '700', fontSize: 12 },
  signOutBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  signOutText: { color: COLORS.danger, fontWeight: '600' },
  addRow: {
    margin: 16, padding: 14, alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: 8,
  },
  addText: { color: '#fff', fontWeight: '700' },
  dangerRow: { padding: 14, alignItems: 'center', marginTop: 'auto' },
  dangerText: { color: COLORS.danger, fontWeight: '700' },
});

