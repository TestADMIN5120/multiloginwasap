'use strict';

/* tiny stdout logger; swap for pino/winston in prod if needed */
const stamp = () => new Date().toISOString();

module.exports = {
  info: (...args) => console.log(`[${stamp()}] [info]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] [warn]`, ...args),
  error: (...args) => console.error(`[${stamp()}] [error]`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${stamp()}] [debug]`, ...args);
    }
  },
};

