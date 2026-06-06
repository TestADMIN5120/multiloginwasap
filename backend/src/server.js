'use strict';

const http = require('http');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const sockets = require('./sockets');
const logger = require('./utils/logger');

async function main() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);
  const io = sockets.attach(server);

  // Make io available to controllers
  app.set('io', io);

  server.listen(env.PORT, () => {
    logger.info(`[http] listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (sig) => {
    logger.info(`[server] received ${sig}, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('[server] fatal:', err);
  process.exit(1);
});

