'use strict';

const { Schema, model } = require('mongoose');

/**
 * An individual identity belonging to a Phone. A single phone can have many accounts.
 */
const accountSchema = new Schema(
  {
    phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
    phone: { type: String, required: true, index: true }, // denormalized for quick search
    username: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: null },
    about: { type: String, default: 'Available' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Same phone cannot create the same username twice
accountSchema.index({ phoneId: 1, username: 1 }, { unique: true });
// Globally unique username (so search results are unambiguous)
accountSchema.index({ username: 1 }, { unique: true });

accountSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    phone: this.phone,
    username: this.username,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    about: this.about,
    lastSeenAt: this.lastSeenAt,
  };
};

module.exports = model('Account', accountSchema);

