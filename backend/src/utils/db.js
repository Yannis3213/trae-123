const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'merchant_entry.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrations = [
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('exception_reasons') WHERE name='missing_types'",
    sql: "ALTER TABLE exception_reasons ADD COLUMN missing_types TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='new_node'",
    sql: "ALTER TABLE batch_results ADD COLUMN new_node TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='new_status'",
    sql: "ALTER TABLE batch_results ADD COLUMN new_status TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='new_version'",
    sql: "ALTER TABLE batch_results ADD COLUMN new_version INTEGER"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='new_handler'",
    sql: "ALTER TABLE batch_results ADD COLUMN new_handler TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='from_node'",
    sql: "ALTER TABLE batch_results ADD COLUMN from_node TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='from_status'",
    sql: "ALTER TABLE batch_results ADD COLUMN from_status TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='from_version'",
    sql: "ALTER TABLE batch_results ADD COLUMN from_version INTEGER"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='from_handler'",
    sql: "ALTER TABLE batch_results ADD COLUMN from_handler TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='exception_type'",
    sql: "ALTER TABLE batch_results ADD COLUMN exception_type TEXT"
  },
  {
    check: "SELECT count(*) as cnt FROM pragma_table_info('batch_results') WHERE name='exception_detail'",
    sql: "ALTER TABLE batch_results ADD COLUMN exception_detail TEXT"
  }
];

for (const migration of migrations) {
  try {
    const result = db.prepare(migration.check).get();
    if (!result || result.cnt === 0) {
      db.exec(migration.sql);
    }
  } catch (e) {
    console.warn(`Migration skipped: ${migration.sql}`, e.message);
  }
}

module.exports = db;
