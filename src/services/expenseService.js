const ExpenseModel = require('../models/expenseModel');
const HttpError = require('../utils/httpError');
const { normalizeAmount } = require('../utils/decimal');

class ExpenseService {
  static async listExpenses(userId) {
    return ExpenseModel.findAllByUserId(userId);
  }

  static async createExpense(userId, payload) {
    const amount = normalizeAmount(payload.amount);
    const expenseDate = payload.expense_date ? new Date(payload.expense_date) : new Date();

    if (Number.isNaN(expenseDate.getTime())) {
      throw new HttpError(422, 'expense_date must be a valid ISO date.');
    }

    return ExpenseModel.create({
      userId,
      title: payload.title,
      amount,
      category: payload.category || '',
      notes: payload.notes || '',
      expenseDate
    });
  }

  static async deleteExpense(userId, expenseId) {
    const expense = await ExpenseModel.findByIdAndUserId(expenseId, userId);

    if (!expense) {
      throw new HttpError(404, 'Expense not found.');
    }

    await ExpenseModel.deleteByIdAndUserId(expenseId, userId);
  }

  static async getSummary(userId, period) {
    const normalizedPeriod = String(period || 'monthly').toLowerCase();

    if (!['daily', 'monthly', 'yearly'].includes(normalizedPeriod)) {
      throw new HttpError(422, 'period must be daily, monthly, or yearly.');
    }

    return ExpenseModel.getSummaryByPeriod(userId, normalizedPeriod);
  }
}

module.exports = ExpenseService;
