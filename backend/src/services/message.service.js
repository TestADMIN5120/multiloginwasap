'use strict';

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

async function persistMessage({ conversationId, senderAccountId, type, text, mediaUrl, mediaName }) {
  const message = await Message.create({
    conversationId,
    senderAccountId,
    type: type || 'text',
    text: text || '',
    mediaUrl: mediaUrl || null,
    mediaName: mediaName || null,
    readBy: [senderAccountId],
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      lastMessage: {
        _id: message._id,
        text: message.text,
        type: message.type,
        senderAccountId: message.senderAccountId,
        createdAt: message.createdAt,
      },
      lastActivityAt: message.createdAt,
    },
  });

  return message;
}

/**
 * Broadcast a `message:new` to every member's `account:<id>` room
 * so all of a user's installs receive the event.
 */
function broadcastNewMessage(io, conversation, message) {
  for (const memberId of conversation.members) {
    io.to(`account:${memberId.toString()}`).emit('message:new', {
      conversationId: conversation._id.toString(),
      message: serializeMessage(message),
    });
  }
}

function serializeMessage(m) {
  return {
    id: m._id.toString(),
    conversationId: m.conversationId.toString(),
    senderAccountId: m.senderAccountId.toString(),
    type: m.type,
    text: m.text,
    mediaUrl: m.mediaUrl,
    mediaName: m.mediaName,
    readBy: (m.readBy || []).map((x) => x.toString()),
    createdAt: m.createdAt,
  };
}

module.exports = { persistMessage, broadcastNewMessage, serializeMessage };

