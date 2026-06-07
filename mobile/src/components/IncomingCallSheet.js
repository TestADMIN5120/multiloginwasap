// mobile/src/components/IncomingCallSheet.js
// ---------------------------------------------------------------------------
// Full-screen modal that pops up when a `call:ringing` event arrives.
// Rendered at the top of the navigation tree so it overlays any screen.
// ---------------------------------------------------------------------------

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useCall } from '../context/CallContext';
import { COLORS } from '../utils/constants';

export default function IncomingCallSheet() {
  const { incomingCall, acceptIncoming, declineIncoming } = useCall();
  if (!incomingCall) return null;

  const peer = incomingCall.peer || {};
  const name = peer.displayName || peer.username || 'Unknown';
  const isVideo = incomingCall.type === 'video';

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={declineIncoming}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.label}>Incoming {isVideo ? 'Video' : 'Voice'} Call</Text>
          <Text style={styles.name}>{name}</Text>
          {peer.username ? <Text style={styles.handle}>@{peer.username}</Text> : null}
        </View>

        <View style={styles.avatarRing}>
          <Text style={styles.avatarText}>{(name[0] || '?').toUpperCase()}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btn}
            onPress={declineIncoming}
            accessibilityLabel="Decline call"
          >
            <Text style={[styles.btnIcon, { backgroundColor: COLORS.danger }]}>✕</Text>
            <Text style={styles.btnLabel}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btn}
            onPress={acceptIncoming}
            accessibilityLabel="Accept call"
          >
            <Text style={[styles.btnIcon, { backgroundColor: COLORS.accent }]}>
              {isVideo ? '🎥' : '📞'}
            </Text>
            <Text style={styles.btnLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  top: { alignItems: 'center', marginTop: 24 },
  label: { color: '#fff', opacity: 0.85, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' },
  name: { color: '#fff', fontSize: 30, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  handle: { color: '#fff', opacity: 0.7, marginTop: 4, fontSize: 14 },

  avatarRing: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { color: '#fff', fontSize: 56, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 36, marginBottom: 16 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  btnIcon: {
    width: 76, height: 76, borderRadius: 38,
    textAlign: 'center', textAlignVertical: 'center', lineHeight: 76,
    fontSize: 30, color: '#fff', overflow: 'hidden',
  },
  btnLabel: { color: '#fff', marginTop: 8, fontSize: 13 },
  decline: {},
  accept: {},
});

// Background colors via inline override (StyleSheet doesn't allow dynamic mix)
IncomingCallSheet.defaultProps = {};

