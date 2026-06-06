'use strict';

const { Schema, model } = require('mongoose');

/**
 * A verified phone number. Can host multiple Account identities.
 */
const phoneSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    verifiedAt: { type: Date, default: null },
    accountIds: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
  },
  { timestamps: true }
);

module.exports = model('Phone', phoneSchema);

