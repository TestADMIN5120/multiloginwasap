import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '../../context/AccountContext';
import { useSocket } from '../../context/SocketContext';
import * as messageApi from '../../api/message.api';
import MessageBubble from '../../components/MessageBubble';
import ChatInput from '../../components/ChatInput';
import { COLORS } from '../../utils/constants';

export default function ChatScreen({ route, navigation }) {
  const { conversation } = route.params;
  const { activeAccount } = useAccount();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingPeer, setTypingPeer] = useState(false);
  const listRef = useRef(null);

  const meId = activeAccount?.id;
  const other = conversation.type === 'dm'
    ? conversation.members.find((m) => m.id !== meId) || conversation.members[0]
    : null;
  const title = conversation.type === 'group'
    ? conversation.name || 'Group'
    : (other?.displayName || other?.username || 'Chat');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const msgs = await messageApi.listMessages(conversation.id);
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return undefined;

    socket.emit('conversation:join', { conversationId: conversation.id });

    const onNew = ({ conversationId, message }) => {
      if (conversationId !== conversation.id) return;
      setMessages((prev) => {
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Mark received messages as read
      if (message.senderAccountId !== meId) {
        socket.emit('message:read', { messageId: message.id });
      }
    };

    const onTyping = ({ conversationId, accountId, isTyping }) => {
      if (conversationId !== conversation.id) return;
      if (accountId === meId) return;
      setTypingPeer(!!isTyping);
    };

    socket.on('message:new', onNew);
    socket.on('typing', onTyping);

    return () => {
      socket.off('message:new', onNew);
      socket.off('typing', onTyping);
      socket.emit('conversation:leave', { conversationId: conversation.id });
    };
  }, [socket, conversation.id, meId]);

  const handleSend = useCallback((text) => {
    // Optimistic add
    const tempId = `tmp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversationId: conversation.id,
      senderAccountId: meId,
      type: 'text',
      text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    if (socket) {
      socket.emit('message:send', { conversationId: conversation.id, type: 'text', text }, (ack) => {
        if (ack?.ok) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? ack.message : m)));
        } else {
          // fall back to REST
          messageApi.sendMessage(conversation.id, { type: 'text', text })
            .then((real) => setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m))))
            .catch(() => setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m))));
        }
      });
    } else {
      messageApi.sendMessage(conversation.id, { type: 'text', text })
        .then((real) => setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m))))
        .catch(() => setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m))));
    }
  }, [conversation.id, meId, socket]);

  // Same idea as handleSend but for media (image / file). The backend already
  // accepts {type, mediaUrl, mediaName} on both REST and socket paths — see
  // backend/src/controllers/message.controller.js and sockets/handlers.js.
  const handleSendMedia = useCallback(({ type, mediaUrl, mediaName }) => {
    const tempId = `tmp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversationId: conversation.id,
      senderAccountId: meId,
      type,
      text: '',
      mediaUrl,
      mediaName,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const payload = { conversationId: conversation.id, type, mediaUrl, mediaName };

    if (socket) {
      socket.emit('message:send', payload, (ack) => {
        if (ack?.ok) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? ack.message : m)));
        } else {
          messageApi.sendMessage(conversation.id, { type, mediaUrl, mediaName })
            .then((real) => setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m))))
            .catch(() => setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m))));
        }
      });
    } else {
      messageApi.sendMessage(conversation.id, { type, mediaUrl, mediaName })
        .then((real) => setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m))))
        .catch(() => setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m))));
    }
  }, [conversation.id, meId, socket]);

  const handleTyping = useCallback((isTyping) => {
    if (socket) socket.emit('typing', { conversationId: conversation.id, isTyping });
  }, [socket, conversation.id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {typingPeer ? <Text style={styles.subtitle}>typing…</Text> : null}
        </View>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.primary} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble message={item} mine={item.senderAccountId === meId} />}
            contentContainerStyle={{ paddingVertical: 6 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}
        <ChatInput onSend={handleSend} onTyping={handleTyping} onSendMedia={handleSendMedia} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.primary, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  back: { color: '#fff', fontSize: 28, paddingHorizontal: 6 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#fff', opacity: 0.85, fontSize: 12 },
});

