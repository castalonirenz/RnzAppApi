const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function hasSmtpConfig() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpFrom);
}

function getTransporter() {
  if (!transporter) {
    const auth = env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined;

    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      ...(auth ? { auth } : {})
    });
  }

  return transporter;
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const safeName = String(name || '').trim() || 'User';
  const subject = 'Reset your password';
  const text = [
    `Hi ${safeName},`,
    '',
    'We received a request to reset your password.',
    `Reset link: ${resetUrl}`,
    '',
    `This link expires in ${env.passwordResetTokenExpiresMinutes} minutes.`,
    '',
    'If you did not request this, you can ignore this email.'
  ].join('\n');

  const html = `
    <p>Hi ${safeName},</p>
    <p>We received a request to reset your password.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>This link expires in ${env.passwordResetTokenExpiresMinutes} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  if (!hasSmtpConfig()) {
    console.warn('SMTP is not configured. Password reset email not sent.');
    console.warn(`Password reset link for ${to}: ${resetUrl}`);
    return {
      sent: false,
      method: 'log',
      reason: 'SMTP is not configured.'
    };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.smtpFrom,
      to,
      subject,
      text,
      html
    });

    return {
      sent: true,
      method: 'smtp',
      message_id: info.messageId || null,
      accepted: Array.isArray(info.accepted) ? info.accepted : [],
      rejected: Array.isArray(info.rejected) ? info.rejected : []
    };
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
    return {
      sent: false,
      method: 'smtp_error',
      reason: error.message
    };
  }
}

module.exports = {
  sendPasswordResetEmail
};
