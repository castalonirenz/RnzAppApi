const db = require('../config/database');

class LoanModel {
  static create(payload) {
    const statement = db.prepare(`
      INSERT INTO loans (
        user_id,
        borrower_name,
        principal,
        interest_rate,
        duration_months,
        total_receivable,
        status
      )
      VALUES (
        @userId,
        @borrowerName,
        @principal,
        @interestRate,
        @durationMonths,
        @totalReceivable,
        @status
      )
    `);

    const result = statement.run(payload);
    return this.findByIdAndUserId(result.lastInsertRowid, payload.userId);
  }

  static findAllByUserId(userId) {
    return db.prepare(`
      SELECT
        l.id,
        l.user_id,
        l.borrower_name,
        l.principal,
        l.interest_rate,
        l.duration_months,
        l.total_receivable,
        l.status,
        l.created_at,
        COALESCE(SUM(CAST(p.amount AS REAL)), 0) AS total_paid
      FROM loans l
      LEFT JOIN payments p ON p.loan_id = l.id
      WHERE l.user_id = ?
      GROUP BY l.id
      ORDER BY datetime(l.created_at) DESC, l.id DESC
    `).all(userId);
  }

  static findByIdAndUserId(id, userId) {
    return db.prepare(`
      SELECT
        l.id,
        l.user_id,
        l.borrower_name,
        l.principal,
        l.interest_rate,
        l.duration_months,
        l.total_receivable,
        l.status,
        l.created_at,
        COALESCE(SUM(CAST(p.amount AS REAL)), 0) AS total_paid
      FROM loans l
      LEFT JOIN payments p ON p.loan_id = l.id
      WHERE l.id = ? AND l.user_id = ?
      GROUP BY l.id
    `).get(id, userId);
  }

  static updateById(id, userId, payload) {
    db.prepare(`
      UPDATE loans
      SET
        borrower_name = @borrowerName,
        principal = @principal,
        interest_rate = @interestRate,
        duration_months = @durationMonths,
        total_receivable = @totalReceivable
      WHERE id = @id AND user_id = @userId
    `).run({
      id,
      userId,
      ...payload
    });

    return this.findByIdAndUserId(id, userId);
  }

  static updateStatusById(id, userId, status) {
    db.prepare(`
      UPDATE loans
      SET status = ?
      WHERE id = ? AND user_id = ?
    `).run(status, id, userId);

    return this.findByIdAndUserId(id, userId);
  }

  static deleteById(id, userId) {
    return db.prepare(`
      DELETE FROM loans
      WHERE id = ? AND user_id = ?
    `).run(id, userId);
  }

  static getDashboardSummary(userId) {
    return db.prepare(`
      SELECT
        COUNT(*) AS total_loans,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_loans,
        SUM(CASE WHEN status = 'Ongoing' THEN 1 ELSE 0 END) AS ongoing_loans,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_loans,
        COALESCE(SUM(CAST(total_receivable AS REAL)), 0) AS total_receivable,
        COALESCE((
          SELECT SUM(CAST(p.amount AS REAL))
          FROM payments p
          INNER JOIN loans pl ON pl.id = p.loan_id
          WHERE pl.user_id = ?
        ), 0) AS total_paid
      FROM loans
      WHERE user_id = ?
    `).get(userId, userId);
  }
}

module.exports = LoanModel;
