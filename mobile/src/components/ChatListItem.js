import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { COLORS } from '../utils/constants';
import { formatRelative } from '../utils/time';

export default function ChatListItem({ conversation, meId, onPress }) {
  const other = conversation.type === 'dm'
    ? conversation.members.find((m) => m.id !== meId) || conversation.members[0]
    : null;
  const title = conversation.type === 'group'
    ? conversation.name || 'Group'
    : (other?.displayName || other?.username || 'Unknown');

  const last = conversation.lastMessage;
  const preview = last
    ? (last.type === 'text' ? last.text : `📎 ${last.type}`)
    : 'No messages yet';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar name={title} size={48} />
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
      </View>
      <Text style={styles.time}>
        {formatRelative(conversation.lastActivityAt)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  middle: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  preview: { color: COLORS.textMuted, marginTop: 2 },
  time: { color: COLORS.textMuted, fontSize: 12 },
});

