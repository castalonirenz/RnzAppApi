const { mongoose } = require('../config/database');
const { PAYABLE_PAYMENT_METHOD_VALUES } = require('../utils/payablesConstants');

function toIsoDateOnly(dateValue) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const payablePaymentSchema = new mongoose.Schema(
  {
    payableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payable',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amountPaid: {
      type: String,
      required: true
    },
    paymentDate: {
      type: Date,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: PAYABLE_PAYMENT_METHOD_VALUES,
      default: 'other',
      required: true
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
  }
);

payablePaymentSchema.index({ payableId: 1, paymentDate: 1, _id: 1 });
payablePaymentSchema.index({ userId: 1, createdAt: -1 });

const PayablePayment = mongoose.models.PayablePayment || mongoose.model('PayablePayment', payablePaymentSchema);

function toPayablePaymentDTO(paymentDoc) {
  if (!paymentDoc) {
    return null;
  }

  return {
    id: String(paymentDoc._id),
    payable_id: String(paymentDoc.payableId),
    user_id: String(paymentDoc.userId),
    amount_paid: Number(paymentDoc.amountPaid || 0),
    payment_date: toIsoDateOnly(paymentDoc.paymentDate),
    payment_method: paymentDoc.paymentMethod,
    notes: paymentDoc.notes || '',
    created_at: new Date(paymentDoc.createdAt).toISOString()
  };
}

class PayablePaymentModel {
  static async create({ payableId, userId, amountPaid, paymentDate, paymentMethod, notes = '' }) {
    const payment = await PayablePayment.create({
      payableId,
      userId,
      amountPaid,
      paymentDate,
      paymentMethod,
      notes
    });

    return toPayablePaymentDTO(payment);
  }

  static async findByPayableIdAndUserId(payableId, userId) {
    const rows = await PayablePayment.find({ payableId, userId }).sort({ paymentDate: 1, _id: 1 }).lean();
    return rows.map(toPayablePaymentDTO);
  }

  static async deleteByPayableIdAndUserId(payableId, userId) {
    await PayablePayment.deleteMany({ payableId, userId });
  }
}

module.exports = PayablePaymentModel;
