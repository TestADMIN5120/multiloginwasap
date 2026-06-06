'use strict';

const Conversation = require('../models/Conversation');
const Account = require('../models/Account');

async function list(req, res, next) {
  try {
    const myId = req.auth.accountId;
    const convs = await Conversation.find({ members: myId })
      .sort({ lastActivityAt: -1 })
      .limit(100)
      .lean();

    // hydrate other-member info for DMs
    const memberIds = new Set();
    for (const c of convs) for (const m of c.members) memberIds.add(String(m));
    const accounts = await Account.find({ _id: { $in: Array.from(memberIds) } }).lean();
    const map = new Map(accounts.map((a) => [String(a._id), a]));

    const enriched = convs.map((c) => ({
      id: String(c._id),
      type: c.type,
      name: c.name,
      avatarUrl: c.avatarUrl,
      members: c.members.map((m) => {
        const a = map.get(String(m));
        return a
          ? { id: String(a._id), username: a.username, displayName: a.displayName, avatarUrl: a.avatarUrl, phone: a.phone }
          : { id: String(m) };
      }),
      lastMessage: c.lastMessage || null,
      lastActivityAt: c.lastActivityAt,
    }));

    return res.json({ conversations: enriched });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const myId = req.auth.accountId;
    const { type = 'dm', memberIds = [], name } = req.body || {};

    if (!Array.isArray(memberIds) || memberIds.length < 1) {
      return res.status(400).json({ error: 'members_required' });
    }
    const allMembers = Array.from(new Set([myId, ...memberIds.map(String)]));

    if (type === 'dm') {
      if (allMembers.length !== 2) return res.status(400).json({ error: 'dm_must_have_two_members' });
      // dedupe: find any existing dm with exactly the same 2 members
      const existing = await Conversation.findOne({
        type: 'dm',
        members: { $all: allMembers, $size: 2 },
      });
      if (existing) return res.json({ conversation: serialize(existing) });
    }

    // Validate members exist
    const found = await Account.find({ _id: { $in: allMembers } }).select('_id');
    if (found.length !== allMembers.length) {
      return res.status(400).json({ error: 'invalid_member' });
    }

    const conv = await Conversation.create({
      type,
      members: allMembers,
      name: type === 'group' ? (name || 'New group') : null,
      createdBy: myId,
    });

    return res.status(201).json({ conversation: serialize(conv) });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const myId = req.auth.accountId;
    const conv = await Conversation.findOne({ _id: req.params.id, members: myId });
    if (!conv) return res.status(404).json({ error: 'not_found' });
    return res.json({ conversation: serialize(conv) });
  } catch (err) {
    return next(err);
  }
}

function serialize(c) {
  return {
    id: String(c._id),
    type: c.type,
    name: c.name,
    avatarUrl: c.avatarUrl,
    members: c.members.map(String),
    lastMessage: c.lastMessage || null,
    lastActivityAt: c.lastActivityAt,
  };
}

module.exports = { list, create, getOne };

