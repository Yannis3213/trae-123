import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/zhaoshang.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;

export function runQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(params);
}

export function getQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(params);
}

export function allQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(params);
}

export function beginTransaction() {
  db.prepare('BEGIN').run();
}

export function commitTransaction() {
  db.prepare('COMMIT').run();
}

export function rollbackTransaction() {
  db.prepare('ROLLBACK').run();
}
