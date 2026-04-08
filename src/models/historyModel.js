const db = require('../config/database');

class HistoryModel {
  static create({ loanId, action, amountPaid = null, balanceAfter = null }) {
    const statement = db.prepare(`
      INSERT INTO history (loan_id, action, amount_paid, balance_after)
      VALUES (@loanId, @action, @amountPaid, @balanceAfter)
    `);

    return statement.run({
      loanId,
      action,
      amountPaid,
      balanceAfter
    });
  }

  static findByLoanId(loanId) {
    return db.prepare(`
      SELECT id, loan_id, action, amount_paid, balance_after, created_at
      FROM history
      WHERE loan_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
    `).all(loanId);
  }
}

module.exports = HistoryModel;
