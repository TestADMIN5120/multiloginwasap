import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet, Platform, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../utils/constants';
import { uploadFile } from '../api/upload.api';
import { inferFileMeta } from '../utils/media';

export default function ChatInput({ onSend, onTyping, onSendMedia }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSend = () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    onSend(v);
  };

  const handleAttach = async () => {
    if (busy) return;
    try {
      // Permissions: media library only — we don't launch the camera here.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'Allow photo library access to send images.',
        );
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        // SDK 17 prefers the array form. The legacy `MediaTypeOptions.Images`
        // still works but logs a deprecation warning.
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      const { name, mimeType } = inferFileMeta(asset);

      setBusy(true);
      const res = await uploadFile({ uri: asset.uri, name, mimeType });
      // res = { url, filename, size, mimeType }
      if (onSendMedia) {
        onSendMedia({
          type: 'image',
          mediaUrl: res.url,
          mediaName: res.filename || name,
        });
      }
    } catch (err) {
      Alert.alert('Upload failed', err?.message || 'Could not send image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={[styles.attachBtn, busy && { opacity: 0.6 }]}
        onPress={handleAttach}
        disabled={busy}
        activeOpacity={0.7}
      >
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Text style={styles.attachIcon}>📎</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (onTyping) onTyping(v.length > 0);
        }}
        placeholder="Message"
        placeholderTextColor={COLORS.textMuted}
        multiline
        editable={!busy}
      />
      <TouchableOpacity
        onPress={handleSend}
        style={[styles.sendBtn, busy && { opacity: 0.6 }]}
        activeOpacity={0.8}
        disabled={busy}
      >
        <Text style={styles.sendIcon}>➤</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.bg,
  },
  attachBtn: {
    width: 40,
    height: 40,
    marginRight: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  attachIcon: { fontSize: 20 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    minHeight: 40,
    maxHeight: 120,
    color: COLORS.text,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: COLORS.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

