const db = require('../config/database');

class PaymentModel {
  static create({ loanId, amount }) {
    const statement = db.prepare(`
      INSERT INTO payments (loan_id, amount)
      VALUES (@loanId, @amount)
    `);

    const result = statement.run({ loanId, amount });
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare(`
      SELECT id, loan_id, amount, created_at
      FROM payments
      WHERE id = ?
    `).get(id);
  }

  static findByLoanId(loanId) {
    return db.prepare(`
      SELECT id, loan_id, amount, created_at
      FROM payments
      WHERE loan_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
    `).all(loanId);
  }

  static getTotalPaidByLoanId(loanId) {
    const result = db.prepare(`
      SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS total_paid
      FROM payments
      WHERE loan_id = ?
    `).get(loanId);

    return result ? Number(result.total_paid).toFixed(2) : '0.00';
  }
}

module.exports = PaymentModel;
