import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '..', 'data', 'chronic.db')

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message)
  }
})

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')
})

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function prepare(sql) {
  return {
    run: (...params) => {
      return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql)
        stmt.run(...params, function (err) {
          if (err) {
            stmt.finalize()
            reject(err)
          } else {
            stmt.finalize()
            resolve({ lastID: this.lastID, changes: this.changes })
          }
        })
      })
    },
    get: (...params) => {
      return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql)
        stmt.get(...params, (err, row) => {
          if (err) {
            stmt.finalize()
            reject(err)
          } else {
            stmt.finalize()
            resolve(row)
          }
        })
      })
    },
    all: (...params) => {
      return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql)
        stmt.all(...params, (err, rows) => {
          if (err) {
            stmt.finalize()
            reject(err)
          } else {
            stmt.finalize()
            resolve(rows)
          }
        })
      })
    }
  }
}

function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export default {
  all,
  get,
  run,
  exec,
  prepare,
  close
}
