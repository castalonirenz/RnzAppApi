const LoanModel = require('../models/loanModel');
const PaymentModel = require('../models/paymentModel');
const HistoryModel = require('../models/historyModel');
const HttpError = require('../utils/httpError');
const {
  normalizeAmount,
  calculateTotalReceivable,
  subtractAmounts,
  toCents
} = require('../utils/decimal');

const STATUS_FLOW = ['Pending', 'Ongoing', 'Completed'];

function formatLoan(loan) {
  if (!loan) {
    return null;
  }

  const totalPaid = Number(loan.total_paid || 0).toFixed(2);
  const remainingBalance = subtractAmounts(loan.total_receivable, totalPaid);

  return {
    id: loan.id,
    userId: loan.user_id,
    borrowerName: loan.borrower_name,
    principal: normalizeAmount(loan.principal),
    interestRate: normalizeAmount(loan.interest_rate),
    durationMonths: loan.duration_months,
    totalReceivable: normalizeAmount(loan.total_receivable),
    totalPaid,
    remainingBalance,
    status: loan.status,
    createdAt: loan.created_at
  };
}

class LoanService {
  static async listLoans(userId) {
    const loans = await LoanModel.findAllByUserId(userId);
    return loans.map(formatLoan);
  }

  static async getLoan(userId, loanId) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }

    return formatLoan(loan);
  }

  static async createLoan(userId, payload) {
    const principal = normalizeAmount(payload.principal);
    const interestRate = normalizeAmount(payload.interestRate);
    const durationMonths = Number(payload.durationMonths);
    const totalReceivable = calculateTotalReceivable(principal, Number(interestRate), durationMonths);

    const loan = await LoanModel.create({
      userId,
      borrowerName: payload.borrowerName,
      principal,
      interestRate,
      durationMonths,
      totalReceivable,
      status: 'Pending'
    });

    await HistoryModel.create({
      loanId: loan.id,
      action: 'Loan created',
      balanceAfter: totalReceivable
    });

    return formatLoan(loan);
  }

  static async updateLoan(userId, loanId, payload) {
    const currentLoan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!currentLoan) {
      throw new HttpError(404, 'Loan not found.');
    }

    if (currentLoan.status !== 'Pending') {
      throw new HttpError(409, 'Only pending loans can be edited.');
    }

    const principal = normalizeAmount(payload.principal);
    const interestRate = normalizeAmount(payload.interestRate);
    const durationMonths = Number(payload.durationMonths);
    const totalReceivable = calculateTotalReceivable(principal, Number(interestRate), durationMonths);

    const updatedLoan = await LoanModel.updateById(loanId, userId, {
      borrowerName: payload.borrowerName,
      principal,
      interestRate,
      durationMonths,
      totalReceivable
    });

    await HistoryModel.create({
      loanId,
      action: 'Loan updated',
      balanceAfter: totalReceivable
    });

    return formatLoan(updatedLoan);
  }

  static async updateStatus(userId, loanId, status) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }

    const currentIndex = STATUS_FLOW.indexOf(loan.status);
    const nextIndex = STATUS_FLOW.indexOf(status);

    if (nextIndex === -1) {
      throw new HttpError(422, 'Invalid loan status.');
    }

    if (nextIndex < currentIndex) {
      throw new HttpError(409, 'Loan status cannot move backwards.');
    }

    if (nextIndex === currentIndex) {
      return formatLoan(loan);
    }

    const updatedLoan = await LoanModel.updateStatusById(loanId, userId, status);

    await HistoryModel.create({
      loanId,
      action: `Status changed to ${status}`,
      balanceAfter: subtractAmounts(updatedLoan.total_receivable, updatedLoan.total_paid || '0.00')
    });

    return formatLoan(updatedLoan);
  }

  static async deleteLoan(userId, loanId) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }

    if (loan.status !== 'Pending') {
      throw new HttpError(409, 'Only pending loans can be deleted.');
    }

    await LoanModel.deleteById(loanId, userId);
  }

  static async addPayment(userId, loanId, amount) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }

    if (loan.status === 'Pending') {
      throw new HttpError(409, 'Loan must be marked as ongoing before adding payments.');
    }

    if (loan.status === 'Completed') {
      throw new HttpError(409, 'Completed loans cannot receive more payments.');
    }

    const normalizedAmount = normalizeAmount(amount);

    if (toCents(normalizedAmount) <= 0) {
      throw new HttpError(422, 'Payment amount must be greater than zero.');
    }

    const payment = await PaymentModel.create({
      loanId,
      amount: normalizedAmount
    });

    const refreshedLoan = await LoanModel.findByIdAndUserId(loanId, userId);
    const remainingBalance = subtractAmounts(refreshedLoan.total_receivable, refreshedLoan.total_paid || '0.00');
    const nextStatus = toCents(remainingBalance) <= 0 ? 'Completed' : refreshedLoan.status;

    if (nextStatus !== refreshedLoan.status) {
      await LoanModel.updateStatusById(loanId, userId, nextStatus);
    }

    await HistoryModel.create({
      loanId,
      action: nextStatus === 'Completed' ? 'Payment received and loan completed' : 'Payment received',
      amountPaid: normalizedAmount,
      balanceAfter: remainingBalance
    });

    const finalLoan = await LoanModel.findByIdAndUserId(loanId, userId);

    return {
      payment,
      loan: formatLoan(finalLoan)
    };
  }

  static async getLoanHistory(userId, loanId) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }

    return {
      loan: formatLoan(loan),
      payments: (await PaymentModel.findByLoanId(loanId)).map((payment) => ({
        id: payment.id,
        loanId: payment.loan_id,
        amount: normalizeAmount(payment.amount),
        createdAt: payment.created_at
      })),
      history: (await HistoryModel.findByLoanId(loanId)).map((entry) => ({
        id: entry.id,
        loanId: entry.loan_id,
        action: entry.action,
        amountPaid: entry.amount_paid ? normalizeAmount(entry.amount_paid) : null,
        balanceAfter: entry.balance_after ? normalizeAmount(entry.balance_after) : null,
        createdAt: entry.created_at
      }))
    };
  }
}

module.exports = LoanService;
