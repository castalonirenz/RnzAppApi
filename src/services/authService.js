const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const UserModel = require('../models/userModel');
const LoanModel = require('../models/loanModel');
const HttpError = require('../utils/httpError');
const { sendPasswordResetEmail } = require('../utils/email');

class AuthService {
  static register = async ({ name, email, password, confirm_password }) => {
    const existingUser = await UserModel.findByEmail(email);

    if (existingUser) {
      throw new HttpError(409, 'Email is already registered.');
    }

    if (String(password || '') !== String(confirm_password || '')) {
      throw new HttpError(422, 'Password and confirm_password must match.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword
    });

    return this.buildAuthResponse(user);
  };

  static login = async ({ email, password }) => {
    const user = await UserModel.findByEmail(email);

    if (!user) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const safeUser = await UserModel.findById(user.id);
    return this.buildAuthResponse(safeUser);
  };

  static async requestPasswordReset({ email }) {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const user = await UserModel.findByEmail(normalizedEmail);

    const genericMessage =
      'If an account with that email exists, a password reset link has been sent.';

    if (!user) {
      return { message: genericMessage };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + env.passwordResetTokenExpiresMinutes * 60 * 1000);

    await UserModel.setPasswordResetTokenById(user.id, tokenHash, expiresAt);

    const separator = env.frontendResetPasswordUrl.includes('?') ? '&' : '?';
    const resetUrl = `${env.frontendResetPasswordUrl}${separator}token=${encodeURIComponent(rawToken)}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl
    });

    return { message: genericMessage };
  }

  static async resetPassword({ token, password, confirm_password }) {
    if (String(password || '') !== String(confirm_password || '')) {
      throw new HttpError(422, 'Password and confirm_password must match.');
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await UserModel.findByValidResetTokenHash(tokenHash);

    if (!user) {
      throw new HttpError(400, 'Invalid or expired reset token.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await UserModel.updatePasswordById(user.id, hashedPassword);

    return {
      message: 'Password has been reset successfully.'
    };
  }

  static async getProfile(userId) {
    const user = await UserModel.findById(userId);
    const summary = (await LoanModel.getDashboardSummary(userId)) || {};
    const totalReceivable = Number(summary.total_receivable || 0);
    const totalPaid = Number(summary.total_paid || 0);

    return {
      ...user,
      dashboard: {
        totalLoans: Number(summary.total_loans || 0),
        pendingLoans: Number(summary.pending_loans || 0),
        ongoingLoans: Number(summary.ongoing_loans || 0),
        completedLoans: Number(summary.completed_loans || 0),
        totalReceivable: totalReceivable.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        outstandingBalance: (totalReceivable - totalPaid).toFixed(2)
      }
    };
  }

  static buildAuthResponse(user) {
    const token = jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn
    });

    return {
      user,
      token
    };
  }
}

module.exports = AuthService;
