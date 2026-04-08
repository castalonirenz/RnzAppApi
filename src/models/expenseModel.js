const { mongoose } = require('../config/database');

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: '',
      trim: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    expenseDate: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

function toExpenseDTO(expenseDoc) {
  if (!expenseDoc) {
    return null;
  }

  return {
    id: String(expenseDoc._id),
    user_id: String(expenseDoc.userId),
    title: expenseDoc.title,
    amount: Number(expenseDoc.amount),
    category: expenseDoc.category || '',
    notes: expenseDoc.notes || '',
    expense_date: new Date(expenseDoc.expenseDate).toISOString(),
    created_at: new Date(expenseDoc.createdAt).toISOString(),
    updated_at: new Date(expenseDoc.updatedAt).toISOString()
  };
}

class ExpenseModel {
  static async findAllByUserId(userId) {
    const expenses = await Expense.find({ userId }).sort({ expenseDate: -1, _id: -1 }).lean();
    return expenses.map(toExpenseDTO);
  }

  static async create({ userId, title, amount, category, notes, expenseDate }) {
    const expense = await Expense.create({
      userId,
      title,
      amount,
      category,
      notes,
      expenseDate
    });

    return toExpenseDTO(expense);
  }

  static async findByIdAndUserId(id, userId) {
    const expense = await Expense.findOne({ _id: id, userId }).lean();
    return toExpenseDTO(expense);
  }

  static async deleteByIdAndUserId(id, userId) {
    await Expense.findOneAndDelete({ _id: id, userId });
  }

  static async getSummaryByPeriod(userId, period) {
    const dateExpression =
      period === 'daily'
        ? { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } }
        : period === 'yearly'
          ? { $dateToString: { format: '%Y', date: '$expenseDate' } }
          : { $dateToString: { format: '%Y-%m', date: '$expenseDate' } };

    const rows = await Expense.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: dateExpression,
          total: { $sum: { $toDouble: '$amount' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return rows.map((row) => ({
      period: row._id,
      total: Number(row.total || 0)
    }));
  }
}

module.exports = ExpenseModel;
