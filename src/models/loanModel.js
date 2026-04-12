const { mongoose } = require('../config/database');
const PaymentModel = require('./paymentModel');

const loanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    borrowerName: {
      type: String,
      required: true,
      trim: true
    },
    borrowerContact: {
      type: String,
      default: '',
      trim: true
    },
    borrowerAddress: {
      type: String,
      default: '',
      trim: true
    },
    principal: {
      type: String,
      required: true
    },
    interestRate: {
      type: String,
      required: true
    },
    interestType: {
      type: String,
      enum: ['monthly', 'annum', 'month', 'year'],
      default: 'monthly',
      required: true
    },
    durationMonths: {
      type: Number,
      required: true
    },
    totalReceivable: {
      type: String,
      required: true
    },
    releaseDate: {
      type: Date,
      required: false
    },
    status: {
      type: String,
      enum: ['pending', 'ongoing', 'completed', 'Pending', 'Ongoing', 'Completed'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
  }
);

const Loan = mongoose.models.Loan || mongoose.model('Loan', loanSchema);

function toLoanDTO(loanDoc, totalPaid = '0.00') {
  if (!loanDoc) {
    return null;
  }

  return {
    id: String(loanDoc._id),
    user_id: String(loanDoc.userId),
    borrower_name: loanDoc.borrowerName,
    borrower_contact: loanDoc.borrowerContact || '',
    borrower_address: loanDoc.borrowerAddress || '',
    principal: loanDoc.principal,
    interest_rate: loanDoc.interestRate,
    interest_period:
      String(loanDoc.interestType || 'monthly').toLowerCase() === 'annum' ||
        String(loanDoc.interestType || 'monthly').toLowerCase() === 'year'
        ? 'year'
        : 'month',
    duration_months: loanDoc.durationMonths,
    total_receivable: loanDoc.totalReceivable,
    status: String(loanDoc.status || 'pending').toLowerCase(),
    release_date: loanDoc.releaseDate ? new Date(loanDoc.releaseDate).toISOString() : null,
    created_at: new Date(loanDoc.createdAt).toISOString(),
    total_payments: totalPaid
  };
}

class LoanModel {
  static async create(payload) {
    const loan = await Loan.create(payload);
    return this.findByIdAndUserId(String(loan._id), String(payload.userId));
  }

  static async findAllByUserId(userId) {
    const loans = await Loan.find({ userId }).sort({ createdAt: -1, _id: -1 }).lean();
    const totals = await PaymentModel.getTotalPaidByLoanIds(loans.map((loan) => String(loan._id)));

    return loans.map((loan) => {
      const totalPaid = totals.get(String(loan._id)) || '0.00';
      return toLoanDTO(loan, totalPaid);
    });
  }

  static async findByIdAndUserId(id, userId) {
    const loan = await Loan.findOne({ _id: id, userId }).lean();

    if (!loan) {
      return null;
    }

    const totalPaid = await PaymentModel.getTotalPaidByLoanId(String(loan._id));
    return toLoanDTO(loan, totalPaid);
  }

  static async updateById(id, userId, payload) {
    await Loan.findOneAndUpdate(
      { _id: id, userId },
      {
        borrowerName: payload.borrowerName,
        borrowerContact: payload.borrowerContact,
        borrowerAddress: payload.borrowerAddress,
        principal: payload.principal,
        interestRate: payload.interestRate,
        interestType: payload.interestType,
        durationMonths: payload.durationMonths,
        totalReceivable: payload.totalReceivable
      }
    );

    return this.findByIdAndUserId(id, userId);
  }

  static async updateStatusById(id, userId, status, releaseDate) {
    await Loan.findOneAndUpdate({ _id: id, userId }, { status, releaseDate });
    return this.findByIdAndUserId(id, userId);
  }

  static async deleteById(id, userId) {
    await Loan.findOneAndDelete({ _id: id, userId });
  }

  static async getDashboardSummary(userId) {
    const loans = await Loan.find({ userId }).select('status totalReceivable').lean();
    const normalized = loans.map((loan) => ({
      ...loan,
      status: String(loan.status || '').toLowerCase()
    }));

    const totalLoans = normalized.length;
    const pendingLoans = normalized.filter((loan) => loan.status === 'pending').length;
    const ongoingLoans = normalized.filter((loan) => loan.status === 'ongoing').length;
    const completedLoans = normalized.filter((loan) => loan.status === 'completed').length;
    const totalReceivable = normalized.reduce((sum, loan) => sum + Number(loan.totalReceivable), 0);

    const totalPaid = await PaymentModel.getTotalPaidByUserId(userId);

    return {
      total_loans: totalLoans,
      pending_loans: pendingLoans,
      ongoing_loans: ongoingLoans,
      completed_loans: completedLoans,
      total_receivable: totalReceivable,
      total_paid: Number(totalPaid)
    };
  }
}

module.exports = LoanModel;
