const BudgetModel = require('../models/budgetModel');
const HttpError = require('../utils/httpError');
const { normalizeAmount } = require('../utils/decimal');
const { buildPdfFromLines } = require('../utils/pdf');
const { normalizePeriodType, getPeriodStart, resolveBudgetWindow, isDateInsideWindow } = require('../utils/budgetPeriod');

function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toIsoDate(dateValue) {
  return new Date(dateValue).toISOString();
}

function toDateStamp(dateValue) {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCsvReport({ budget, window, expenses, totalSpent, remainingBalance }) {
  const rows = [
    ['budget_id', 'name', 'amount_limit', 'period_type', 'start_date', 'end_date', 'window_start', 'window_end', 'total_spent', 'remaining_balance'],
    [
      String(budget._id),
      budget.name,
      Number(budget.amountLimit).toFixed(2),
      budget.periodType,
      toIsoDate(budget.startDate),
      budget.endDate ? toIsoDate(budget.endDate) : '',
      toIsoDate(window.start),
      toIsoDate(window.end),
      totalSpent.toFixed(2),
      remainingBalance.toFixed(2)
    ],
    [],
    ['expense_id', 'title', 'amount', 'category', 'notes', 'expense_date', 'created_at', 'updated_at'],
    ...expenses.map((expense) => [
      String(expense._id),
      expense.title,
      Number(expense.amount).toFixed(2),
      expense.category || '',
      expense.notes || '',
      toIsoDate(expense.expenseDate),
      toIsoDate(expense.createdAt),
      toIsoDate(expense.updatedAt)
    ])
  ];

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildPdfReportLines({ budget, window, expenses, totalSpent, remainingBalance }) {
  const lines = [
    `Budget Report - ${budget.name}`,
    `Budget ID: ${String(budget._id)}`,
    `Period Type: ${budget.periodType}`,
    `Amount Limit: ${Number(budget.amountLimit).toFixed(2)}`,
    `Budget Start: ${toIsoDate(budget.startDate)}`,
    `Budget End: ${budget.endDate ? toIsoDate(budget.endDate) : 'N/A'}`,
    `Window Start: ${toIsoDate(window.start)}`,
    `Window End: ${toIsoDate(window.end)}`,
    `Total Spent: ${totalSpent.toFixed(2)}`,
    `Remaining Balance: ${remainingBalance.toFixed(2)}`,
    '',
    'Expenses'
  ];

  const maxExpenseLines = 35;
  const selected = expenses.slice(0, maxExpenseLines);

  for (const expense of selected) {
    lines.push(
      `${toDateStamp(expense.expenseDate)} | ${expense.title} | ${Number(expense.amount).toFixed(2)} | ${expense.category || 'Uncategorized'}`
    );
  }

  if (expenses.length > maxExpenseLines) {
    lines.push(`... ${expenses.length - maxExpenseLines} more expense(s) not shown`);
  }

  return lines;
}

class BudgetService {
  static async listBudgets(userId) {
    return BudgetModel.findAllByUserId(userId);
  }

  static async createBudget(userId, payload) {
    const periodType = normalizePeriodType(payload.period_type);
    const amountLimit = normalizeAmount(payload.amount_limit);
    const name = String(payload.name || '').trim();

    if (!name) {
      throw new HttpError(422, 'name is required.');
    }

    const startDate = getPeriodStart(new Date(), periodType);

    return BudgetModel.create({
      userId,
      name,
      amountLimit,
      periodType,
      startDate
    });
  }

  static async updateBudget(userId, budgetId, payload) {
    const currentBudget = await BudgetModel.findDocumentByIdAndUserId(budgetId, userId);

    if (!currentBudget) {
      throw new HttpError(404, 'Budget not found');
    }

    const hasField = (field) => Object.prototype.hasOwnProperty.call(payload, field);
    const name = hasField('name') ? String(payload.name || '').trim() : currentBudget.name;
    const amountLimit = hasField('amount_limit')
      ? normalizeAmount(payload.amount_limit)
      : normalizeAmount(currentBudget.amountLimit);
    const periodType = hasField('period_type')
      ? normalizePeriodType(payload.period_type)
      : currentBudget.periodType;
    const startDate = hasField('start_date')
      ? new Date(payload.start_date)
      : new Date(currentBudget.startDate);
    const endDate = hasField('end_date')
      ? payload.end_date
        ? new Date(payload.end_date)
        : null
      : currentBudget.endDate
        ? new Date(currentBudget.endDate)
        : null;

    if (!name) {
      throw new HttpError(422, 'name is required.');
    }

    if (Number.isNaN(startDate.getTime())) {
      throw new HttpError(422, 'start_date must be a valid ISO date.');
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new HttpError(422, 'end_date must be a valid ISO date.');
    }

    if (endDate && endDate < startDate) {
      throw new HttpError(422, 'end_date must be greater than or equal to start_date.');
    }

    const changesBudgetWindow = hasField('period_type') || hasField('start_date') || hasField('end_date');

    if (changesBudgetWindow) {
      const window = resolveBudgetWindow({ startDate, endDate, periodType });
      const outsideCount = await BudgetModel.countExpensesOutsideWindow(userId, budgetId, window);

      if (outsideCount > 0) {
        throw new HttpError(
          409,
          `Cannot update budget window because ${outsideCount} linked expense(s) fall outside the resulting period.`
        );
      }
    }

    return BudgetModel.updateByIdAndUserId(budgetId, userId, {
      name,
      amountLimit,
      periodType,
      startDate,
      endDate
    });
  }

  static async deleteBudget(userId, budgetId) {
    const budget = await BudgetModel.findDocumentByIdAndUserId(budgetId, userId);

    if (!budget) {
      throw new HttpError(404, 'Budget not found');
    }

    await BudgetModel.clearBudgetExpenseLinks(userId, budgetId);
    await BudgetModel.deleteByIdAndUserId(budgetId, userId);
  }

  static async validateBudgetForExpense(userId, budgetId, expenseDate) {
    if (!budgetId) {
      return null;
    }

    const budget = await BudgetModel.findDocumentById(budgetId);

    if (!budget) {
      throw new HttpError(404, 'Budget not found');
    }

    if (String(budget.userId) !== String(userId)) {
      throw new HttpError(403, 'Forbidden');
    }

    const window = resolveBudgetWindow(budget);

    if (!isDateInsideWindow(expenseDate, window)) {
      throw new HttpError(409, 'Expense date is outside the budget period window.');
    }

    return budget;
  }

  static async exportBudget(userId, budgetId, format) {
    const normalizedFormat = String(format || '').toLowerCase();

    if (!['csv', 'pdf'].includes(normalizedFormat)) {
      throw new HttpError(400, 'format must be csv or pdf');
    }

    const budget = await BudgetModel.findDocumentById(budgetId);

    if (!budget) {
      throw new HttpError(404, 'Budget not found');
    }

    if (String(budget.userId) !== String(userId)) {
      throw new HttpError(403, 'Forbidden');
    }

    const reportData = await BudgetModel.findBudgetExpensesByWindow(userId, budgetId);

    const amountLimit = Number(reportData.budget.amountLimit);
    const totalSpent = reportData.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const remainingBalance = Number((amountLimit - totalSpent).toFixed(2));
    const dateStamp = toDateStamp(new Date());
    const filename = `budget-${budgetId}-${dateStamp}.${normalizedFormat}`;

    const enriched = {
      ...reportData,
      totalSpent,
      remainingBalance
    };

    if (normalizedFormat === 'csv') {
      const csv = buildCsvReport(enriched);
      return {
        filename,
        mimeType: 'text/csv',
        content: Buffer.from(csv, 'utf8')
      };
    }

    const lines = buildPdfReportLines(enriched);
    return {
      filename,
      mimeType: 'application/pdf',
      content: buildPdfFromLines(lines)
    };
  }
}

module.exports = BudgetService;
