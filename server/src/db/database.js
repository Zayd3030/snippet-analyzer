import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const schema = `
  CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    sentiment_score REAL,
    sentiment_label TEXT,
    keywords TEXT,
    word_count INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`

export function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  const db = new DatabaseSync(dbPath)
  db.exec(schema)
  return db
}

// relative paths resolve from the cwd, which is server/ when run through the npm scripts
export const db = createDatabase(process.env.DB_PATH ?? './data/snippets.db')
