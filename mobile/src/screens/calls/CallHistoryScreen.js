// mobile/src/screens/calls/CallHistoryScreen.js
// ---------------------------------------------------------------------------
// "Calls" tab — past call history pulled from GET /api/calls.
// Tapping a row redials in audio mode (UI only — backend already records
// every attempt regardless of whether the user has WebRTC).
// ---------------------------------------------------------------------------

import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAccount } from '../../context/AccountContext';
import { useCall } from '../../context/CallContext';
import * as callApi from '../../api/call.api';
import { COLORS } from '../../utils/constants';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function rowSubtitle(call, meId) {
  const incoming = call.callerAccountId !== meId;
  const verb = incoming ? 'Incoming' : 'Outgoing';
  const reason = call.endedReason; // declined | cancelled | missed | hangup
  if (reason === 'missed' && incoming) return 'Missed call';
  if (reason === 'declined') return incoming ? 'Declined' : 'Declined by callee';
  if (reason === 'cancelled') return incoming ? 'Missed call' : 'Cancelled';
  return verb + (call.type === 'video' ? ' video call' : ' voice call');
}

export default function CallHistoryScreen({ navigation }) {
  const { activeAccount } = useAccount();
  const { startCall } = useCall();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const list = await callApi.listCalls();
      setCalls(list);
    } catch (err) {
      Alert.alert('Could not load calls', err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [activeAccount?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const meId = activeAccount?.id;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Calls</Text>
      </View>

      <FlatList
        data={calls}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No calls yet</Text>
            <Text style={styles.emptyText}>
              Open a chat and tap the phone or video icon to start one.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const incoming = item.callerAccountId !== meId;
          const peer =
            (item.participants || []).find((p) => p.accountId !== meId)?.account ||
            { displayName: incoming ? 'Caller' : 'Callee' };
          const name = peer.displayName || peer.username || 'Unknown';
          const missed = item.endedReason === 'missed' && incoming;
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                startCall(item.conversationId, item.type || 'audio', { peer })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(name[0] || '?').toUpperCase()}</Text>
              </View>
              <View style={styles.rowMid}>
                <Text style={[styles.rowName, missed && { color: COLORS.danger }]}>
                  {name}
                </Text>
                <Text style={styles.rowSub}>
                  {incoming ? '↙ ' : '↗ '}
                  {rowSubtitle(item, meId)}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.timeText}>
                  {formatTime(item.endedAt || item.acceptedAt || item.startedAt)}
                </Text>
                <Text style={{ fontSize: 18 }}>{item.type === 'video' ? '🎥' : '📞'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={calls.length === 0 ? { flex: 1 } : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: COLORS.primary, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  back: { color: '#fff', fontSize: 28, paddingHorizontal: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowMid: { flex: 1 },
  rowName: { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  rowSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  timeText: { color: COLORS.textMuted, fontSize: 12 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyText: { color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
});

