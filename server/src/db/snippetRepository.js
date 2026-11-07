import { db } from './database.js'

// id breaks ties when two snippets land in the same millisecond
const selectAll = db.prepare('SELECT * FROM snippets ORDER BY created_at DESC, id DESC')

// RETURNING gives back the full row, so no second query to fetch it
const insert = db.prepare(`
  INSERT INTO snippets (
    title, content, category, sentiment_score, sentiment_label, keywords, word_count,
    created_at, updated_at
  )
  VALUES (
    @title, @content, @category, @sentimentScore, @sentimentLabel, @keywords, @wordCount,
    @createdAt, @updatedAt
  )
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

// no COALESCE here on purpose, a failed analysis has to be able to clear old tags back to null
const updateWithAnalysisById = db.prepare(`
  UPDATE snippets
  SET title = @title,
      content = @content,
      category = @category,
      sentiment_score = @sentimentScore,
      sentiment_label = @sentimentLabel,
      keywords = @keywords,
      word_count = @wordCount,
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

function analysisParams({ category, sentiment, keywords, wordCount }) {
  return {
    category,
    sentimentScore: sentiment?.score ?? null,
    sentimentLabel: sentiment?.label ?? null,
    keywords: keywords ? JSON.stringify(keywords) : null,
    wordCount,
  }
}

export function findAll() {
  return selectAll.all().map(toSnippet)
}

export function create({ title, content }, analysis) {
  const now = new Date().toISOString()
  const row = insert.get({
    title,
    content,
    ...analysisParams(analysis),
    createdAt: now,
    updatedAt: now,
  })
  return toSnippet(row)
}

export function findById(id) {
  const row = selectById.get(id)
  return row ? toSnippet(row) : null
}

// with analysis, title and content must both be passed since everything gets written
export function update(id, { title, content }, analysis) {
  const updatedAt = new Date().toISOString()
  const row = analysis
    ? updateWithAnalysisById.get({ id, title, content, ...analysisParams(analysis), updatedAt })
    : updateById.get({ id, title: title ?? null, content: content ?? null, updatedAt })
  return row ? toSnippet(row) : null
}

export function remove(id) {
  return deleteById.run(id).changes > 0
}
