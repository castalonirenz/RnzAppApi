const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const UserModel = require('../models/userModel');
const LoanModel = require('../models/loanModel');
const HttpError = require('../utils/httpError');

class AuthService {
  static register = async ({ email, password }) => {
    const existingUser = UserModel.findByEmail(email);

    if (existingUser) {
      throw new HttpError(409, 'Email is already registered.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = UserModel.create({
      email,
      password: hashedPassword
    });

    return this.buildAuthResponse(user);
  };

  static login = async ({ email, password }) => {
    const user = UserModel.findByEmail(email);

    if (!user) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const safeUser = UserModel.findById(user.id);
    return this.buildAuthResponse(safeUser);
  };

  static getProfile(userId) {
    const user = UserModel.findById(userId);
    const summary = LoanModel.getDashboardSummary(userId) || {};
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
