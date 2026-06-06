'use strict';

const Account = require('../models/Account');
const { isNonEmptyString } = require('../utils/validators');

async function me(req, res, next) {
  try {
    const account = await Account.findById(req.auth.accountId);
    if (!account) return res.status(404).json({ error: 'not_found' });
    return res.json({ account: account.toPublicJSON() });
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const updates = {};
    if (isNonEmptyString(req.body.displayName, 60)) updates.displayName = req.body.displayName.trim();
    if (isNonEmptyString(req.body.about, 150)) updates.about = req.body.about.trim();
    if (typeof req.body.avatarUrl === 'string') updates.avatarUrl = req.body.avatarUrl;

    const account = await Account.findByIdAndUpdate(req.auth.accountId, { $set: updates }, { new: true });
    return res.json({ account: account.toPublicJSON() });
  } catch (err) {
    return next(err);
  }
}

async function search(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.json({ results: [] });
    // escape regex specials
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${safe}`, 'i');

    const results = await Account.find({
      _id: { $ne: req.auth.accountId },
      $or: [{ username: regex }, { phone: regex }, { displayName: regex }],
    })
      .limit(20)
      .sort({ username: 1 });

    return res.json({ results: results.map((a) => a.toPublicJSON()) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { me, updateMe, search };

