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

const STATUS_FLOW = ['pending', 'ongoing', 'completed'];

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

function toInterestType(value) {
  const type = String(value || 'month').toLowerCase();
  return type === 'year' || type === 'annum' ? 'annum' : 'monthly';
}

function formatLoan(loan) {
  if (!loan) {
    return null;
  }

  const totalPaid = Number(loan.total_payments || 0).toFixed(2);
  const remainingBalance = subtractAmounts(loan.total_receivable, totalPaid);

  return {
    id: loan.id,
    user_id: loan.user_id,
    borrower_name: loan.borrower_name,
    borrower_contact: loan.borrower_contact || '',
    borrower_address: loan.borrower_address || '',
    principal: normalizeAmount(loan.principal),
    interest_rate: normalizeAmount(loan.interest_rate),
    interest_period: loan.interest_period || 'month',
    duration_months: loan.duration_months,
    total_receivable: normalizeAmount(loan.total_receivable),
    total_payments: totalPaid,
    remaining_balance: remainingBalance,
    status: normalizeStatus(loan.status),
    release_date: loan.release_date || null,
    created_at: loan.created_at
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
    const interestRate = normalizeAmount(payload.interest_rate);
    const interestType = toInterestType(payload.interest_period);
    const durationMonths = Number(payload.duration_months);
    const totalReceivable = calculateTotalReceivable(
      principal,
      Number(interestRate),
      durationMonths,
      interestType
    );

    const loan = await LoanModel.create({
      userId,
      borrowerName: payload.borrower_name,
      borrowerContact: payload.borrower_contact || '',
      borrowerAddress: payload.borrower_address || '',
      principal,
      interestRate,
      interestType,
      durationMonths,
      totalReceivable,
      status: 'pending'
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

    if (normalizeStatus(currentLoan.status) !== 'pending' && normalizeStatus(currentLoan.status) !== 'ongoing') {
      throw new HttpError(409, 'Only pending loans can be edited.');
    }

   

    const principal = normalizeAmount(payload.principal);
    const interestRate = normalizeAmount(payload.interest_rate);
    const interestType = toInterestType(payload.interest_period);
    const durationMonths = Number(payload.duration_months);
    const totalReceivable = calculateTotalReceivable(
      principal,
      Number(interestRate),
      durationMonths,
      interestType
    );

    const updatedLoan = await LoanModel.updateById(loanId, userId, {
      borrowerName: payload.borrower_name,
      borrowerContact: payload.borrower_contact || '',
      borrowerAddress: payload.borrower_address || '',
      principal,
      interestRate,
      interestType,
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

  static async updateStatus(userId, loanId, status, releaseDate) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }
     if(releaseDate == "" || releaseDate == null || releaseDate == undefined){
       throw new HttpError(409, 'Release date is required.');
    }

    const normalizedCurrentStatus = normalizeStatus(loan.status);
    const normalizedNextStatus = normalizeStatus(status);
    const currentIndex = STATUS_FLOW.indexOf(normalizedCurrentStatus);
    const nextIndex = STATUS_FLOW.indexOf(normalizedNextStatus);

    if (nextIndex === -1) {
      throw new HttpError(422, 'Invalid loan status.');
    }

    if (nextIndex < currentIndex) {
      throw new HttpError(409, 'Loan status cannot move backwards.');
    }

    const updatedLoan = await LoanModel.updateStatusById(loanId, userId, normalizedNextStatus, releaseDate);

    if (nextIndex === currentIndex) {
      return formatLoan(updatedLoan);
    }

    await HistoryModel.create({
      loanId,
      action: 'status',
      amountPaid: null,
      balanceAfter: subtractAmounts(updatedLoan.total_receivable, updatedLoan.total_payments || '0.00')
    });

    return formatLoan(updatedLoan);
  }

  static async deleteLoan(userId, loanId) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }

    if (normalizeStatus(loan.status) !== 'pending') {
      throw new HttpError(409, 'Only pending loans can be deleted.');
    }

    await LoanModel.deleteById(loanId, userId);
  }

  static async addPayment(userId, loanId, amount, paidAt) {
    const loan = await LoanModel.findByIdAndUserId(loanId, userId);

    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }

    if (normalizeStatus(loan.status) === 'pending') {
      throw new HttpError(409, 'Loan must be marked as ongoing before adding payments.');
    }

    if (normalizeStatus(loan.status) === 'completed') {
      throw new HttpError(409, 'Completed loans cannot receive more payments.');
    }

    const normalizedAmount = normalizeAmount(amount);

    if (toCents(normalizedAmount) <= 0) {
      throw new HttpError(422, 'Payment amount must be greater than zero.');
    }

    const payment = await PaymentModel.create({
      loanId,
      amount: normalizedAmount,
      paidAt: paidAt || null
    });

    const refreshedLoan = await LoanModel.findByIdAndUserId(loanId, userId);
    const remainingBalance = subtractAmounts(
      refreshedLoan.total_receivable,
      refreshedLoan.total_payments || '0.00'
    );
    const currentStatus = normalizeStatus(refreshedLoan.status);
    const nextStatus = toCents(remainingBalance) <= 0 ? 'completed' : currentStatus;

    if (nextStatus !== currentStatus) {
      await LoanModel.updateStatusById(loanId, userId, nextStatus);
    }

    await HistoryModel.create({
      loanId,
      action: 'payment',
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
        loan_id: payment.loan_id,
        amount: normalizeAmount(payment.amount),
        paid_at: payment.paid_at || payment.created_at,
        created_at: payment.created_at
      })),
      history: (await HistoryModel.findByLoanId(loanId)).map((entry) => ({
        id: entry.id,
        loan_id: entry.loan_id,
        action: entry.action,
        details:
          entry.action === 'payment'
            ? `Payment recorded at ${entry.created_at}`
            : `Loan ${entry.action} at ${entry.created_at}`,
        amount_paid: entry.amount_paid ? normalizeAmount(entry.amount_paid) : null,
        balance_after: entry.balance_after ? normalizeAmount(entry.balance_after) : null,
        created_at: entry.created_at
      }))
    };
  }
}

module.exports = LoanService;
