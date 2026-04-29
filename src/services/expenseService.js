const ExpenseModel = require('../models/expenseModel');
const HttpError = require('../utils/httpError');
const { normalizeAmount } = require('../utils/decimal');
const BudgetService = require('./budgetService');
const { normalizePeriodType, isSupportedPeriodType, buildPeriodTypeValidationMessage } = require('../utils/periodTypes');

class ExpenseService {
  static async listExpenses(userId) {
    return ExpenseModel.findAllByUserId(userId);
  }

  static async createExpense(userId, payload) {
    const amount = normalizeAmount(payload.amount);
    const expenseDate = payload.expense_date ? new Date(payload.expense_date) : new Date();
    const budgetId = payload.budget_id ? String(payload.budget_id) : null;

    if (Number.isNaN(expenseDate.getTime())) {
      throw new HttpError(422, 'expense_date must be a valid ISO date.');
    }

    if (budgetId) {
      await BudgetService.validateBudgetForExpense(userId, budgetId, expenseDate);
    }

    return ExpenseModel.create({
      userId,
      title: payload.title,
      amount,
      category: payload.category || '',
      notes: payload.notes || '',
      expenseDate,
      budgetId
    });
  }

  static async updateExpense(userId, expenseId, payload) {
    const currentExpense = await ExpenseModel.findByIdAndUserId(expenseId, userId);

    if (!currentExpense) {
      throw new HttpError(404, 'Expense not found.');
    }

    const hasField = (field) => Object.prototype.hasOwnProperty.call(payload, field);
    const expenseDate = hasField('expense_date')
      ? new Date(payload.expense_date)
      : new Date(currentExpense.expense_date);

    if (Number.isNaN(expenseDate.getTime())) {
      throw new HttpError(422, 'expense_date must be a valid ISO date.');
    }

    const budgetId = hasField('budget_id')
      ? payload.budget_id
        ? String(payload.budget_id)
        : null
      : currentExpense.budget_id
        ? String(currentExpense.budget_id)
        : null;

    if (budgetId) {
      await BudgetService.validateBudgetForExpense(userId, budgetId, expenseDate);
    }

    const amount = hasField('amount') ? normalizeAmount(payload.amount) : normalizeAmount(currentExpense.amount);

    return ExpenseModel.updateByIdAndUserId(expenseId, userId, {
      title: hasField('title') ? payload.title : currentExpense.title,
      amount,
      category: hasField('category') ? payload.category : currentExpense.category || '',
      notes: hasField('notes') ? payload.notes : currentExpense.notes || '',
      expenseDate,
      budgetId
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
    const normalizedPeriod = normalizePeriodType(period || 'monthly');

    if (!isSupportedPeriodType(normalizedPeriod)) {
      throw new HttpError(422, buildPeriodTypeValidationMessage('period'));
    }

    return ExpenseModel.getSummaryByPeriod(userId, normalizedPeriod);
  }
}

module.exports = ExpenseService;
