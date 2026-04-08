const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  override: false
});

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
const nodeEnv = process.env.NODE_ENV || 'development';

if (!mongoUri && nodeEnv === 'production') {
  throw new Error('Missing MongoDB connection string. Set MONGO_URI (or MONGODB_URI) in your environment variables.');
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mongoUri: mongoUri || 'mongodb://127.0.0.1:27017/myborrower',
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  corsAllowVercelPreview: (process.env.CORS_ALLOW_VERCEL_PREVIEW || 'true').toLowerCase() === 'true',
  corsCredentials: (process.env.CORS_CREDENTIALS || 'true').toLowerCase() === 'true'
};
