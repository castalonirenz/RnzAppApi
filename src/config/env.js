const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  override: false
});

module.exports = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/myborrower',
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  corsAllowVercelPreview: (process.env.CORS_ALLOW_VERCEL_PREVIEW || 'true').toLowerCase() === 'true',
  corsCredentials: (process.env.CORS_CREDENTIALS || 'true').toLowerCase() === 'true'
};
