import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as userApi from '../../api/user.api';
import * as conversationApi from '../../api/conversation.api';
import Avatar from '../../components/Avatar';
import { COLORS } from '../../utils/constants';

export default function ContactsScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (q.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await userApi.search(q.trim());
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const startChat = async (user) => {
    try {
      const conv = await conversationApi.create({ type: 'dm', memberIds: [user.id] });
      // fetch full conversation with member details
      const full = await conversationApi.list();
      const me = full.find((c) => c.id === conv.id) || conv;
      navigation.replace('Chat', { conversation: me });
    } catch (err) {
      Alert.alert('Could not start chat', err.message || 'Failed');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Find people</Text>
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search by username, name, or phone"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => startChat(item)}>
            <Avatar name={item.displayName || item.username} size={42} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.user}>@{item.username} · {item.phone}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ color: COLORS.textMuted }}>
              {q.length < 2 ? 'Type at least 2 characters' : (loading ? 'Searching…' : 'No results')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: COLORS.primary, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { color: '#fff', fontSize: 28, paddingHorizontal: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  searchWrap: { padding: 12, backgroundColor: '#fff' },
  search: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  user: { color: COLORS.textMuted, marginTop: 2, fontSize: 12 },
});

