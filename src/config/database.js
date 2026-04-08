const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;
let listenersAttached = false;
let connectPromise = null;

function attachConnectionListeners() {
  if (listenersAttached) {
    return;
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('MongoDB connected.');
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('MongoDB disconnected.');
  });

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });

  listenersAttached = true;
}

async function connectDatabase() {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    await connectPromise;
    return mongoose.connection;
  }

  attachConnectionListeners();
  mongoose.set('bufferCommands', false);

  connectPromise = mongoose
    .connect(env.mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000
    })
    .catch((error) => {
      const details = [
        'Failed to connect to MongoDB.',
        `Reason: ${error.message}`,
        'Checklist: verify MONGO_URI, Atlas username/password, Atlas IP allowlist (or 0.0.0.0/0 for dev), and network access.'
      ].join(' ');
      throw new Error(details);
    })
    .finally(() => {
      connectPromise = null;
    });

  await connectPromise;

  isConnected = true;
  return mongoose.connection;
}

module.exports = {
  mongoose,
  connectDatabase
};
