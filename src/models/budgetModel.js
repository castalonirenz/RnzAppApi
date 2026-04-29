const { mongoose } = require('../config/database');
const { resolveBudgetWindow } = require('../utils/budgetPeriod');
const { SUPPORTED_PERIOD_TYPES } = require('../utils/periodTypes');
require('./expenseModel');

const Expense = mongoose.models.Expense;

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    amountLimit: {
      type: String,
      required: true
    },
    periodType: {
      type: String,
      enum: SUPPORTED_PERIOD_TYPES,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

const Budget = mongoose.models.Budget || mongoose.model('Budget', budgetSchema);

function toBudgetDTO(budgetDoc, totalSpent = 0) {
  if (!budgetDoc) {
    return null;
  }

  const spent = Number(totalSpent || 0);
  const amountLimit = Number(budgetDoc.amountLimit);

  return {
    id: String(budgetDoc._id),
    user_id: String(budgetDoc.userId),
    name: budgetDoc.name,
    amount_limit: amountLimit,
    period_type: budgetDoc.periodType,
    start_date: new Date(budgetDoc.startDate).toISOString(),
    end_date: budgetDoc.endDate ? new Date(budgetDoc.endDate).toISOString() : null,
    total_spent: spent,
    remaining_balance: Number((amountLimit - spent).toFixed(2)),
    created_at: new Date(budgetDoc.createdAt).toISOString(),
    updated_at: new Date(budgetDoc.updatedAt).toISOString()
  };
}

async function calculateBudgetSpend(budgetDoc) {
  const window = resolveBudgetWindow(budgetDoc);

  const rows = await Expense.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(budgetDoc.userId)),
        budgetId: new mongoose.Types.ObjectId(String(budgetDoc._id)),
        expenseDate: {
          $gte: window.start,
          $lte: window.end
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $toDouble: '$amount' } }
      }
    }
  ]);

  return Number(rows[0]?.total || 0);
}

class BudgetModel {
  static async create({ userId, name, amountLimit, periodType, startDate, endDate = null }) {
    const budget = await Budget.create({
      userId,
      name,
      amountLimit,
      periodType,
      startDate,
      endDate
    });

    return toBudgetDTO(budget, 0);
  }

  static async findByIdAndUserId(id, userId) {
    const budget = await Budget.findOne({ _id: id, userId }).lean();

    if (!budget) {
      return null;
    }

    const totalSpent = await calculateBudgetSpend(budget);
    return toBudgetDTO(budget, totalSpent);
  }

  static async updateByIdAndUserId(id, userId, payload) {
    await Budget.findOneAndUpdate(
      { _id: id, userId },
      {
        name: payload.name,
        amountLimit: payload.amountLimit,
        periodType: payload.periodType,
        startDate: payload.startDate,
        endDate: payload.endDate
      }
    );

    return this.findByIdAndUserId(id, userId);
  }

  static async findDocumentByIdAndUserId(id, userId) {
    return Budget.findOne({ _id: id, userId }).lean();
  }

  static async findDocumentById(id) {
    return Budget.findById(id).lean();
  }

  static async findAllByUserId(userId) {
    const budgets = await Budget.find({ userId }).sort({ createdAt: -1, _id: -1 }).lean();

    const rows = await Promise.all(
      budgets.map(async (budget) => {
        const totalSpent = await calculateBudgetSpend(budget);
        return toBudgetDTO(budget, totalSpent);
      })
    );

    return rows;
  }

  static async countExpensesOutsideWindow(userId, budgetId, window) {
    return Expense.countDocuments({
      userId,
      budgetId,
      $or: [{ expenseDate: { $lt: window.start } }, { expenseDate: { $gt: window.end } }]
    });
  }

  static async clearBudgetExpenseLinks(userId, budgetId) {
    await Expense.updateMany({ userId, budgetId }, { $set: { budgetId: null } });
  }

  static async deleteByIdAndUserId(id, userId) {
    await Budget.findOneAndDelete({ _id: id, userId });
  }

  static async findBudgetExpensesByWindow(userId, budgetId) {
    const budget = await this.findDocumentByIdAndUserId(budgetId, userId);

    if (!budget) {
      return null;
    }

    const window = resolveBudgetWindow(budget);
    const expenses = await Expense.find({
      userId,
      budgetId,
      expenseDate: { $gte: window.start, $lte: window.end }
    })
      .sort({ expenseDate: 1, _id: 1 })
      .lean();

    return {
      budget,
      window,
      expenses
    };
  }
}

module.exports = BudgetModel;
