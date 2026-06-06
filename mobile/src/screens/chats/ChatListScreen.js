import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAccount } from '../../context/AccountContext';
import { useSocket } from '../../context/SocketContext';
import * as conversationApi from '../../api/conversation.api';
import ChatListItem from '../../components/ChatListItem';
import AccountSwitcherTabs from '../../components/AccountSwitcherTabs';
import { COLORS } from '../../utils/constants';

export default function ChatListScreen({ navigation }) {
  const { activeAccount } = useAccount();
  const { socket, connected } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const list = await conversationApi.list();
      setConversations(list);
    } catch (err) {
      Alert.alert('Could not load chats', err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [activeAccount?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Subscribe to message:new and bump conversation list
  useEffect(() => {
    if (!socket) return undefined;
    const onNew = ({ conversationId, message }) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx < 0) {
          // New conversation we don't know about — refetch
          load();
          return prev;
        }
        const next = prev.slice();
        next[idx] = {
          ...next[idx],
          lastMessage: {
            _id: message.id,
            text: message.text,
            type: message.type,
            senderAccountId: message.senderAccountId,
            createdAt: message.createdAt,
          },
          lastActivityAt: message.createdAt,
        };
        next.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
        return next;
      });
    };
    socket.on('message:new', onNew);
    return () => socket.off('message:new', onNew);
  }, [socket, load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Chats</Text>
          {activeAccount ? (
            <Text style={styles.headerSubtitle}>
              @{activeAccount.username} · {connected ? '🟢 online' : '⚪ connecting…'}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.headerAction}>⚙</Text>
        </TouchableOpacity>
      </View>

      <AccountSwitcherTabs onAdd={() => navigation.navigate('AddAccount')} />

      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ChatListItem
            conversation={item}
            meId={activeAccount?.id}
            onPress={() => navigation.navigate('Chat', { conversation: item })}
          />
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyText}>Tap the button below to start one.</Text>
          </View>
        }
        contentContainerStyle={conversations.length === 0 ? { flex: 1 } : null}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Contacts')}>
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: COLORS.primary, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#fff', opacity: 0.85, marginTop: 2, fontSize: 12 },
  headerAction: { color: '#fff', fontSize: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyText: { color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 16, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '700' },
});

