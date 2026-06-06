'use strict';

const { Schema, model } = require('mongoose');

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    text: { type: String, default: '' },
    mediaUrl: { type: String, default: null },
    mediaName: { type: String, default: null },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = model('Message', messageSchema);

