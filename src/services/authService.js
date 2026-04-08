const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const UserModel = require('../models/userModel');
const LoanModel = require('../models/loanModel');
const HttpError = require('../utils/httpError');

class AuthService {
  static register = async ({ name, email, password }) => {
    const existingUser = await UserModel.findByEmail(email);

    if (existingUser) {
      throw new HttpError(409, 'Email is already registered.');
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
