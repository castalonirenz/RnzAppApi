const { mongoose } = require('../config/database');
const { PAYABLE_STATUS_VALUES, PAYABLE_FREQUENCY_VALUES } = require('../utils/payablesConstants');

function toIsoDateOnly(dateValue) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const payableSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    creditorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    principalAmount: {
      type: String,
      required: true
    },
    amountPaid: {
      type: String,
      required: true,
      default: '0.00'
    },
    balance: {
      type: String,
      required: true
    },
    dueDate: {
      type: Date,
      required: true,
      index: true
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurrenceEndDate: {
      type: Date,
      default: null
    },
    frequency: {
      type: String,
      enum: PAYABLE_FREQUENCY_VALUES,
      default: 'once',
      required: true
    },
    status: {
      type: String,
      enum: PAYABLE_STATUS_VALUES,
      default: 'pending',
      required: true,
      index: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

payableSchema.index({ userId: 1, dueDate: 1, createdAt: -1 });
payableSchema.index({ userId: 1, status: 1, dueDate: 1 });
payableSchema.index({ userId: 1, creditorName: 1 });

const Payable = mongoose.models.Payable || mongoose.model('Payable', payableSchema);

function toPayableDTO(payableDoc) {
  if (!payableDoc) {
    return null;
  }

  return {
    id: String(payableDoc._id),
    user_id: String(payableDoc.userId),
    creditor_name: payableDoc.creditorName,
    description: payableDoc.description || '',
    principal_amount: Number(payableDoc.principalAmount || 0),
    amount_paid: Number(payableDoc.amountPaid || 0),
    balance: Number(payableDoc.balance || 0),
    due_date: toIsoDateOnly(payableDoc.dueDate),
    is_recurring: Boolean(payableDoc.isRecurring),
    recurrence_end_date: payableDoc.recurrenceEndDate ? toIsoDateOnly(payableDoc.recurrenceEndDate) : null,
    frequency: payableDoc.frequency,
    status: payableDoc.status,
    created_at: new Date(payableDoc.createdAt).toISOString(),
    updated_at: new Date(payableDoc.updatedAt).toISOString()
  };
}

class PayableModel {
  static toDTO(payableDoc) {
    return toPayableDTO(payableDoc);
  }

  static toDTOList(payableDocs) {
    return (payableDocs || []).map(toPayableDTO);
  }

  static async create(payload) {
    const payable = await Payable.create(payload);
    return toPayableDTO(payable);
  }

  static async createMany(payloads) {
    const payables = await Payable.insertMany(payloads, { ordered: true });
    return payables.map(toPayableDTO);
  }

  static async findByIdAndUserId(id, userId) {
    const payable = await Payable.findOne({ _id: id, userId }).lean();
    return toPayableDTO(payable);
  }

  static async findRawByIdAndUserId(id, userId) {
    return Payable.findOne({ _id: id, userId }).lean();
  }

  static async findAllRawByUserId(userId, filters = {}) {
    const query = { userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.creditorName) {
      query.creditorName = { $regex: filters.creditorName, $options: 'i' };
    }

    return Payable.find(query).lean();
  }

  static async updateByIdAndUserId(id, userId, payload) {
    await Payable.findOneAndUpdate(
      { _id: id, userId },
      {
        creditorName: payload.creditorName,
        description: payload.description,
        principalAmount: payload.principalAmount,
        amountPaid: payload.amountPaid,
        balance: payload.balance,
        dueDate: payload.dueDate,
        isRecurring: payload.isRecurring,
        recurrenceEndDate: payload.recurrenceEndDate,
        frequency: payload.frequency,
        status: payload.status
      },
      { runValidators: true }
    );

    return this.findByIdAndUserId(id, userId);
  }

  static async deleteByIdAndUserId(id, userId) {
    await Payable.findOneAndDelete({ _id: id, userId });
  }
}

module.exports = PayableModel;
