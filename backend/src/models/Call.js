'use strict';

const { Schema, model } = require('mongoose');

/**
 * One row per call attempt. Created on `call:invite`, updated as the call
 * progresses (accept / decline / connect / end). Survives page reloads so
 * the caller and callee can re-join an in-progress call after a network
 * blip.
 *
 * Lifecycle:
 *   ringing  -> accepted -> ended           (normal call)
 *   ringing  -> declined                    (callee said no)
 *   ringing  -> cancelled                   (caller hung up before pickup)
 *   ringing  -> missed                      (no answer in 60s)
 */
const callSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    callerAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    // For 1:1 calls this is a single account. We keep it as an array so the
    // schema is ready for group calling later (multi-party WebRTC mesh).
    calleeAccountIds: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
    type: { type: String, enum: ['audio', 'video'], required: true },
    status: {
      type: String,
      enum: ['ringing', 'accepted', 'declined', 'cancelled', 'missed', 'ended'],
      default: 'ringing',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },   // when invite was sent
    answeredAt: { type: Date, default: null },      // when callee accepted
    endedAt: { type: Date, default: null },         // when call hung up
    endedReason: { type: String, default: null },   // 'hangup' | 'declined' | 'cancelled' | 'missed' | 'error'
  },
  { timestamps: true }
);

callSchema.virtual('durationSeconds').get(function () {
  if (!this.answeredAt || !this.endedAt) return 0;
  return Math.max(0, Math.floor((this.endedAt - this.answeredAt) / 1000));
});

callSchema.set('toJSON', { virtuals: true });

callSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = model('Call', callSchema);

