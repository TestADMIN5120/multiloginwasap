'use strict';

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const messageService = require('../services/message.service');

async function listMessages(req, res, next) {
  try {
    const myId = req.auth.accountId;
    const conv = await Conversation.findOne({ _id: req.params.id, members: myId });
    if (!conv) return res.status(404).json({ error: 'not_found' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    const filter = { conversationId: conv._id };
    if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };

    const docs = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
    return res.json({
      messages: docs.reverse().map(messageService.serializeMessage),
    });
  } catch (err) {
    return next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const myId = req.auth.accountId;
    const conv = await Conversation.findOne({ _id: req.params.id, members: myId });
    if (!conv) return res.status(404).json({ error: 'not_found' });

    const { type = 'text', text = '', mediaUrl = null, mediaName = null } = req.body || {};
    if (type === 'text' && (!text || !String(text).trim())) {
      return res.status(400).json({ error: 'empty_message' });
    }

    const message = await messageService.persistMessage({
      conversationId: conv._id,
      senderAccountId: myId,
      type,
      text: String(text || '').slice(0, 4000),
      mediaUrl,
      mediaName,
    });

    const io = req.app.get('io');
    if (io) messageService.broadcastNewMessage(io, conv, message);

    return res.status(201).json({ message: messageService.serializeMessage(message) });
  } catch (err) {
    return next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const myId = req.auth.accountId;
    const m = await Message.findById(req.params.id);
    if (!m) return res.status(404).json({ error: 'not_found' });

    const conv = await Conversation.findOne({ _id: m.conversationId, members: myId });
    if (!conv) return res.status(403).json({ error: 'forbidden' });

    if (!m.readBy.map(String).includes(String(myId))) {
      m.readBy.push(myId);
      await m.save();
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listMessages, sendMessage, markRead };

