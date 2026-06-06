'use strict';

const { Schema, model } = require('mongoose');

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ['dm', 'group'], required: true },
    name: { type: String, default: null }, // for groups
    avatarUrl: { type: String, default: null },
    members: [{ type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    // Denormalized snapshot of the latest message — Mixed avoids Mongoose's
    // "type:" keyword collision when one of the inner fields is also called type.
    lastMessage: { type: Schema.Types.Mixed, default: null },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

conversationSchema.index({ members: 1, lastActivityAt: -1 });

module.exports = model('Conversation', conversationSchema);

