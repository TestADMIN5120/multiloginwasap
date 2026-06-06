'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    logger.info(`[db] connected to ${env.MONGO_URI}`);
  } catch (err) {
    logger.error('[db] connection error:', err.message);
    // retry once after short delay
    setTimeout(() => {
      logger.info('[db] retrying connection...');
      connectDB().catch(() => process.exit(1));
    }, 5000);
  }
}

module.exports = { connectDB, mongoose };

