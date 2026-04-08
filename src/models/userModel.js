const db = require('../config/database');

class UserModel {
  static create({ email, password }) {
    const statement = db.prepare(`
      INSERT INTO users (email, password)
      VALUES (@email, @password)
    `);

    const result = statement.run({ email, password });
    return this.findById(result.lastInsertRowid);
  }

  static findByEmail(email) {
    return db.prepare(`
      SELECT id, email, password, created_at
      FROM users
      WHERE email = ?
    `).get(email);
  }

  static findById(id) {
    return db.prepare(`
      SELECT id, email, created_at
      FROM users
      WHERE id = ?
    `).get(id);
  }

  static findByIdWithPassword(id) {
    return db.prepare(`
      SELECT id, email, password, created_at
      FROM users
      WHERE id = ?
    `).get(id);
  }
}

module.exports = UserModel;
