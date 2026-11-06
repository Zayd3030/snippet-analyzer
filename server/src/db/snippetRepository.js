import { db } from './database.js'

// id breaks ties when two snippets land in the same millisecond
const selectAll = db.prepare('SELECT * FROM snippets ORDER BY created_at DESC, id DESC')

// RETURNING gives back the full row, so no second query to fetch it
const insert = db.prepare(`
  INSERT INTO snippets (title, content, created_at, updated_at)
  VALUES (@title, @content, @createdAt, @updatedAt)
  RETURNING *
`)

const selectById = db.prepare('SELECT * FROM snippets WHERE id = ?')

// fields that weren't sent come in as null, and COALESCE keeps the current value for those
const updateById = db.prepare(`
  UPDATE snippets
  SET title = COALESCE(@title, title),
      content = COALESCE(@content, content),
      updated_at = @updatedAt
  WHERE id = @id
  RETURNING *
`)

const deleteById = db.prepare('DELETE FROM snippets WHERE id = ?')

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

export function findById(id) {
  const row = selectById.get(id)
  return row ? toSnippet(row) : null
}

export function update(id, { title, content }) {
  const row = updateById.get({
    id,
    title: title ?? null,
    content: content ?? null,
    updatedAt: new Date().toISOString(),
  })
  return row ? toSnippet(row) : null
}

export function remove(id) {
  return deleteById.run(id).changes > 0
}
