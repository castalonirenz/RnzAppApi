const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('./env');

const dataDir = path.dirname(env.dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(env.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
