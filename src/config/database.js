const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }

  await mongoose.connect(env.mongoUri, {
    autoIndex: true
  });

  isConnected = true;
  return mongoose.connection;
}

module.exports = {
  mongoose,
  connectDatabase
};
