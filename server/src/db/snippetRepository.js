import { db } from './database.js'

// id breaks ties when two snippets land in the same millisecond
const selectAll = db.prepare('SELECT * FROM snippets ORDER BY created_at DESC, id DESC')

// RETURNING gives back the full row, so no second query to fetch it
const insert = db.prepare(`
  INSERT INTO snippets (title, content, created_at, updated_at)
  VALUES (@title, @content, @createdAt, @updatedAt)
  RETURNING *
`)

function toSnippet(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    sentimentScore: row.sentiment_score,
    sentimentLabel: row.sentiment_label,
    keywords: row.keywords ? JSON.parse(row.keywords) : [],
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findAll() {
  return selectAll.all().map(toSnippet)
}

export function create({ title, content }) {
  const now = new Date().toISOString()
  const row = insert.get({ title, content, createdAt: now, updatedAt: now })
  return toSnippet(row)
}
