// mobile/src/screens/calls/CallScreen.js
// ---------------------------------------------------------------------------
// Renders during an active call. Auto-shown when activeCall is set.
//
// Renders a remote video (or audio-only avatar), a small self-preview,
// and the mute/end/switch-camera/speaker controls.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useCall } from '../../context/CallContext';
import { RTCView } from '../../utils/webrtc';
import { COLORS } from '../../utils/constants';

function durationLabel(startedAt) {
  if (!startedAt) return '';
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function CallScreen() {
  const {
    activeCall,
    localStream,
    remoteStream,
    muted,
    cameraOn,
    speakerOn,
    hangup,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    switchCamera,
  } = useCall();

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!activeCall) return null;

  const peerName = activeCall.peer?.displayName || activeCall.peer?.username || 'Calling…';
  const isVideo = activeCall.type === 'video';
  const showRemoteVideo = isVideo && !!remoteStream && RTCView;
  const showSelfVideo = isVideo && !!localStream && cameraOn && RTCView;

  const statusLabel = (() => {
    switch (activeCall.status) {
      case 'ringing':    return activeCall.role === 'caller' ? 'Ringing…' : 'Connecting…';
      case 'connecting': return 'Connecting…';
      case 'connected':  return durationLabel(activeCall.acceptedAt || activeCall.startedAt);
      case 'ended':      return `Call ended${activeCall.endedReason ? ` · ${activeCall.endedReason}` : ''}`;
      default:           return '';
    }
  })();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Remote video / avatar */}
      {showRemoteVideo ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          objectFit="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.audioBackdrop]}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{(peerName[0] || '?').toUpperCase()}</Text>
          </View>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.peerName}>{peerName}</Text>
        <Text style={styles.peerStatus}>{statusLabel}</Text>
      </View>

      {/* Self-preview pip */}
      {showSelfVideo ? (
        <View style={styles.pip}>
          <RTCView
            streamURL={localStream.toURL()}
            objectFit="cover"
            mirror
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ) : null}

      {/* Controls */}
      <View style={styles.controls}>
        <ControlBtn label={muted ? 'Unmute' : 'Mute'} icon={muted ? '🔇' : '🎙'} onPress={toggleMute} />
        {isVideo ? (
          <ControlBtn label={cameraOn ? 'Camera off' : 'Camera on'} icon={cameraOn ? '📷' : '🚫'} onPress={toggleCamera} />
        ) : (
          <ControlBtn label={speakerOn ? 'Speaker' : 'Earpiece'} icon={speakerOn ? '🔊' : '📞'} onPress={toggleSpeaker} />
        )}
        {isVideo ? (
          <ControlBtn label="Flip" icon="🔄" onPress={switchCamera} />
        ) : (
          <ControlBtn label={muted ? 'Unmute' : 'Mute'} icon={muted ? '🔇' : '🎙'} onPress={toggleMute} hidden />
        )}
        <ControlBtn label="End" icon="✕" onPress={hangup} danger />
      </View>
    </View>
  );
}

function ControlBtn({ icon, label, onPress, danger, hidden }) {
  if (hidden) return <View style={{ width: 64 }} />;
  return (
    <TouchableOpacity onPress={onPress} style={styles.ctrlBtn}>
      <Text
        style={[
          styles.ctrlIcon,
          { backgroundColor: danger ? COLORS.danger : 'rgba(255,255,255,0.18)' },
        ]}
      >
        {icon}
      </Text>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  audioBackdrop: {
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  bigAvatar: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)',
  },
  bigAvatarText: { color: '#fff', fontSize: 64, fontWeight: '700' },

  topBar: {
    position: 'absolute', top: 50, left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: 16,
  },
  peerName: { color: '#fff', fontSize: 24, fontWeight: '700' },
  peerStatus: { color: '#fff', opacity: 0.85, marginTop: 6, fontSize: 14 },

  pip: {
    position: 'absolute', top: 130, right: 16,
    width: 110, height: 150, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#222', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },

  controls: {
    position: 'absolute', left: 0, right: 0, bottom: 40,
    flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 24,
  },
  ctrlBtn: { alignItems: 'center', width: 64 },
  ctrlIcon: {
    width: 60, height: 60, borderRadius: 30,
    color: '#fff', fontSize: 24,
    textAlign: 'center', textAlignVertical: 'center', lineHeight: 60,
    overflow: 'hidden',
  },
  ctrlLabel: { color: '#fff', marginTop: 6, fontSize: 12 },
});

