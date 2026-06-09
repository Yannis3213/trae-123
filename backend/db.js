const Database = require('better-sqlite3');
const path = require('path');
const { DB_PATH } = require('./init-db');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    const dbFile = path.join(__dirname, 'data.db');
    dbInstance = new Database(dbFile);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

module.exports = { getDb };
