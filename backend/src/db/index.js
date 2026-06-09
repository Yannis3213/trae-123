const Database = require('better-sqlite3');
const path = require('path');
const SCHEMA_SQL = require('./schema');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'pharmacy.db');

const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(SCHEMA_SQL);

module.exports = db;
