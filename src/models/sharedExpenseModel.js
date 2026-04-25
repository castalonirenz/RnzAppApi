const { mongoose } = require('../config/database');

const sharedExpenseSchema = new mongoose.Schema(
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
      trim: true,
      maxlength: 100
    },
    amount: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    participants: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100
        }
      ],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0 && value.length <= 20;
        },
        message: 'participants must contain between 1 and 20 items.'
      }
    },
    sharePerPerson: {
      type: String,
      required: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

sharedExpenseSchema.index({ userId: 1, createdAt: -1 });
sharedExpenseSchema.index({ createdAt: -1 });
sharedExpenseSchema.index({ userId: 1, deletedAt: 1 });
sharedExpenseSchema.index(
  { userId: 1, title: 1, deletedAt: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

const SharedExpense = mongoose.models.SharedExpense || mongoose.model('SharedExpense', sharedExpenseSchema);

function toSharedExpenseDTO(expenseDoc) {
  if (!expenseDoc) {
    return null;
  }

  return {
    id: String(expenseDoc._id),
    _id: String(expenseDoc._id),
    title: expenseDoc.title,
    amount: Number(expenseDoc.amount),
    description: expenseDoc.description || '',
    participants: Array.isArray(expenseDoc.participants) ? expenseDoc.participants : [],
    share_per_person: Number(expenseDoc.sharePerPerson),
    created_by: String(expenseDoc.userId),
    created_at: new Date(expenseDoc.createdAt).toISOString(),
    updated_at: new Date(expenseDoc.updatedAt).toISOString()
  };
}

class SharedExpenseModel {
  static async findAllByUserId(userId, { limit = 50, offset = 0, sort = { createdAt: -1, _id: -1 } } = {}) {
    const query = { userId, deletedAt: null };

    const [docs, total] = await Promise.all([
      SharedExpense.find(query).sort(sort).skip(offset).limit(limit).lean(),
      SharedExpense.countDocuments(query)
    ]);

    return {
      rows: docs.map(toSharedExpenseDTO),
      total
    };
  }

  static async findByIdAndUserId(id, userId) {
    const doc = await SharedExpense.findOne({ _id: id, userId, deletedAt: null }).lean();
    return toSharedExpenseDTO(doc);
  }

  static async findRawByIdAndUserId(id, userId) {
    return SharedExpense.findOne({ _id: id, userId, deletedAt: null }).lean();
  }

  static async findRawById(id) {
    return SharedExpense.findOne({ _id: id, deletedAt: null }).lean();
  }

  static async findAllRawByUserId(userId) {
    return SharedExpense.find({ userId, deletedAt: null }).sort({ createdAt: -1, _id: -1 }).lean();
  }

  static async create({ userId, title, amount, description, participants, sharePerPerson }) {
    const doc = await SharedExpense.create({
      userId,
      title,
      amount,
      description,
      participants,
      sharePerPerson
    });

    return toSharedExpenseDTO(doc);
  }

  static async updateByIdAndUserId(id, userId, payload) {
    await SharedExpense.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      {
        title: payload.title,
        amount: payload.amount,
        description: payload.description,
        participants: payload.participants,
        sharePerPerson: payload.sharePerPerson
      },
      { runValidators: true }
    );

    return this.findByIdAndUserId(id, userId);
  }

  static async softDeleteByIdAndUserId(id, userId) {
    const doc = await SharedExpense.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date() }
    ).lean();

    return Boolean(doc);
  }

  static async existsByTitle(userId, title, excludeId = null) {
    const query = { userId, title, deletedAt: null };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await SharedExpense.findOne(query).select('_id').lean();
    return Boolean(existing);
  }
}

module.exports = SharedExpenseModel;
