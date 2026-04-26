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
  authForgotPasswordVerbose:
    (process.env.AUTH_FORGOT_PASSWORD_VERBOSE ||
      (nodeEnv === 'production' ? 'false' : 'true')).toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  passwordResetTokenExpiresMinutes: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES) || 30,
  frontendResetPasswordUrl: process.env.FRONTEND_RESET_PASSWORD_URL || 'http://localhost:3000/reset-password',
  mongoUri: mongoUri || 'mongodb://127.0.0.1:27017/myborrower',
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  corsAllowVercelPreview: (process.env.CORS_ALLOW_VERCEL_PREVIEW || 'true').toLowerCase() === 'true',
  corsCredentials: (process.env.CORS_CREDENTIALS || 'true').toLowerCase() === 'true',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || ''
};
