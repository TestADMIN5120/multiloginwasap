'use strict';

const Phone = require('../models/Phone');
const Account = require('../models/Account');
const tokenService = require('../services/token.service');
const { isValidUsername, isNonEmptyString } = require('../utils/validators');

async function listAccounts(req, res, next) {
  try {
    const phoneId = req.auth.phoneId;
    const accounts = await Account.find({ phoneId }).sort({ createdAt: 1 });
    return res.json({ accounts: accounts.map((a) => a.toPublicJSON()) });
  } catch (err) {
    return next(err);
  }
}

async function createAccount(req, res, next) {
  try {
    const { phoneId } = req.auth;
    const { username, displayName, about, avatarUrl } = req.body || {};

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'invalid_username' });
    }
    if (!isNonEmptyString(displayName, 60)) {
      return res.status(400).json({ error: 'invalid_display_name' });
    }

    const phoneDoc = await Phone.findById(phoneId);
    if (!phoneDoc) return res.status(404).json({ error: 'phone_not_found' });

    let account;
    try {
      account = await Account.create({
        phoneId,
        phone: phoneDoc.phone,
        username: String(username).toLowerCase(),
        displayName: String(displayName).trim(),
        about: isNonEmptyString(about, 150) ? about : 'Available',
        avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'username_taken' });
      throw err;
    }

    await Phone.findByIdAndUpdate(phoneId, { $addToSet: { accountIds: account._id } });

    const accountToken = tokenService.signAccountToken({ accountId: account._id, phoneId });

    return res.status(201).json({
      account: account.toPublicJSON(),
      accountToken,
    });
  } catch (err) {
    return next(err);
  }
}

async function loginToAccount(req, res, next) {
  try {
    const { phoneId } = req.auth;
    const accountId = req.params.id;

    const account = await Account.findOne({ _id: accountId, phoneId });
    if (!account) return res.status(404).json({ error: 'account_not_found' });

    const accountToken = tokenService.signAccountToken({ accountId: account._id, phoneId });

    return res.json({
      account: account.toPublicJSON(),
      accountToken,
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteAccount(req, res, next) {
  try {
    const { accountId, phoneId } = req.auth;
    if (req.params.id !== accountId) {
      return res.status(403).json({ error: 'cannot_delete_other_account' });
    }
    await Account.deleteOne({ _id: accountId });
    await Phone.findByIdAndUpdate(phoneId, { $pull: { accountIds: accountId } });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listAccounts, createAccount, loginToAccount, deleteAccount };

