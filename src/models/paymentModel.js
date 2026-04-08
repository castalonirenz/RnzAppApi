const { mongoose } = require('../config/database');

const paymentSchema = new mongoose.Schema(
  {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
      index: true
    },
    amount: {
      type: String,
      required: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
  }
);

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

function toPaymentDTO(paymentDoc) {
  if (!paymentDoc) {
    return null;
  }

  return {
    id: String(paymentDoc._id),
    loan_id: String(paymentDoc.loanId),
    amount: paymentDoc.amount,
    created_at: new Date(paymentDoc.createdAt).toISOString()
  };
}

class PaymentModel {
  static async create({ loanId, amount }) {
    const payment = await Payment.create({ loanId, amount });
    return toPaymentDTO(payment);
  }

  static async findById(id) {
    const payment = await Payment.findById(id).lean();
    return toPaymentDTO(payment);
  }

  static async findByLoanId(loanId) {
    const payments = await Payment.find({ loanId }).sort({ createdAt: 1, _id: 1 }).lean();
    return payments.map(toPaymentDTO);
  }

  static async getTotalPaidByLoanId(loanId) {
    const result = await Payment.aggregate([
      { $match: { loanId: new mongoose.Types.ObjectId(loanId) } },
      { $group: { _id: null, totalPaid: { $sum: { $toDouble: '$amount' } } } }
    ]);

    const totalPaid = result[0]?.totalPaid || 0;
    return Number(totalPaid).toFixed(2);
  }

  static async getTotalPaidByLoanIds(loanIds) {
    if (!loanIds.length) {
      return new Map();
    }

    const objectIds = loanIds.map((id) => new mongoose.Types.ObjectId(id));
    const rows = await Payment.aggregate([
      { $match: { loanId: { $in: objectIds } } },
      { $group: { _id: '$loanId', totalPaid: { $sum: { $toDouble: '$amount' } } } }
    ]);

    const totalMap = new Map();

    rows.forEach((row) => {
      totalMap.set(String(row._id), Number(row.totalPaid || 0).toFixed(2));
    });

    return totalMap;
  }

  static async getTotalPaidByUserId(userId) {
    const Loan = mongoose.model('Loan');
    const loans = await Loan.find({ userId }).select('_id').lean();
    const loanIds = loans.map((loan) => String(loan._id));
    const totals = await this.getTotalPaidByLoanIds(loanIds);
    let sum = 0;

    totals.forEach((total) => {
      sum += Number(total);
    });

    return sum.toFixed(2);
  }
}

module.exports = PaymentModel;
