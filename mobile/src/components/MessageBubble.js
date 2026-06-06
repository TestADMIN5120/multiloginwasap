import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';
import { formatTime } from '../utils/time';
import { resolveMediaUrl } from '../utils/media';

export default function MessageBubble({ message, mine }) {
  const renderBody = () => {
    if (message.type === 'image' && message.mediaUrl) {
      const uri = resolveMediaUrl(message.mediaUrl);
      return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(uri)}>
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        </TouchableOpacity>
      );
    }
    if (message.type === 'file' && message.mediaUrl) {
      const uri = resolveMediaUrl(message.mediaUrl);
      return (
        <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL(uri)}>
          <Text style={[styles.text, styles.fileLink]}>📎 {message.mediaName || 'file'}</Text>
        </TouchableOpacity>
      );
    }
    if (message.type === 'text') {
      return <Text style={styles.text}>{message.text}</Text>;
    }
    // Fallback for unknown / pending media without a URL yet
    return <Text style={styles.text}>📎 {message.mediaName || message.type}</Text>;
  };

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        {renderBody()}
        <Text style={styles.time}>
          {formatTime(message.createdAt)}
          {message.pending ? ' · …' : ''}
          {message.failed ? ' · failed' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 8, marginVertical: 2 },
  rowMine: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    borderRadius: 8,
    elevation: 1,
  },
  bubbleMine: { backgroundColor: COLORS.bubbleMe, borderTopRightRadius: 0 },
  bubbleOther: { backgroundColor: COLORS.bubbleOther, borderTopLeftRadius: 0 },
  text: { fontSize: 15, color: COLORS.text },
  fileLink: { color: COLORS.primaryLight, fontWeight: '600' },
  image: {
    width: 220,
    height: 220,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 2,
  },
  time: { fontSize: 10, color: COLORS.textMuted, alignSelf: 'flex-end', marginTop: 2 },
});

