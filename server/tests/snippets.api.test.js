import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../src/app.js'
import { db } from '../src/db/database.js'
import { findAll } from '../src/db/snippetRepository.js'
import { analyze } from '../src/services/analysis/index.js'

// wrap the real functions in spies, so they behave normally unless a test overrides them once
vi.mock('../src/services/analysis/index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, analyze: vi.fn(actual.analyze) }
})

vi.mock('../src/db/snippetRepository.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, findAll: vi.fn(actual.findAll) }
})

const codeSnippet = {
  title: 'Debounce helper',
  content: [
    'const debounce = (fn, ms) => {',
    '  let timer;',
    '  return (...args) => {',
    '    clearTimeout(timer);',
    '    timer = setTimeout(() => fn(...args), ms);',
    '  };',
    '};',
  ].join('\n'),
}

const todoSnippet = {
  title: 'Weekend errands',
  content: "Need to buy groceries and don't forget to pay the electricity bill before Friday.",
}

function createSnippet(body) {
  return request(app).post('/api/snippets').send(body)
}

beforeEach(() => {
  db.exec('DELETE FROM snippets')
  vi.restoreAllMocks()
})

describe('POST /api/snippets', () => {
  it('creates a snippet with analysis attached', async () => {
    const res = await createSnippet(todoSnippet)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      title: todoSnippet.title,
      content: todoSnippet.content,
      category: 'Todo',
      sentimentScore: expect.any(Number),
      sentimentLabel: expect.stringMatching(/^(positive|neutral|negative)$/),
      wordCount: 14,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(res.body.keywords.length).toBeGreaterThan(0)
  })

  it('tags a clearly coded snippet as Code', async () => {
    const res = await createSnippet(codeSnippet)

    expect(res.status).toBe(201)
    expect(res.body.category).toBe('Code')
  })

  it('counts words in the content only, not the title', async () => {
    const res = await createSnippet({ title: 'A fairly long title here', content: 'three words only' })

    expect(res.body.wordCount).toBe(3)
  })

  it('uses the title as a category hint', async () => {
    const res = await createSnippet({ title: 'Standup notes', content: 'Quick notes for the team' })

    expect(res.body.category).toBe('Meeting')
  })

  it('still saves with null analysis if the analyzer throws', async () => {
    vi.mocked(analyze).mockRejectedValueOnce(new Error('analyzer exploded'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await createSnippet(todoSnippet)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      title: todoSnippet.title,
      category: null,
      sentimentScore: null,
      sentimentLabel: null,
      keywords: [],
      wordCount: null,
    })
    expect(consoleError).toHaveBeenCalled()

    const stored = await request(app).get(`/api/snippets/${res.body.id}`)
    expect(stored.status).toBe(200)
  })

  it.each([
    [{ content: 'body' }, 'Title is required'],
    [{ title: 'Title' }, 'Content is required'],
    [{ title: '   ', content: 'body' }, "Title can't be empty"],
    [{ title: 'x'.repeat(121), content: 'body' }, 'Title must be 120 characters or fewer'],
    [{ title: 'Title', content: 42 }, 'Content must be text'],
  ])('rejects invalid body %j', async (body, error) => {
    const res = await createSnippet(body)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error })
  })

  it('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/api/snippets')
      .set('Content-Type', 'application/json')
      .send('{"title": "oops"')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Request body must be valid JSON' })
  })
})

describe('GET /api/snippets', () => {
  it('returns snippets newest first', async () => {
    const first = await createSnippet(todoSnippet)
    const second = await createSnippet(codeSnippet)

    const res = await request(app).get('/api/snippets')

    expect(res.status).toBe(200)
    expect(res.body.map((s) => s.id)).toEqual([second.body.id, first.body.id])
  })

  it('returns a generic 500 with no stack trace when the repository fails', async () => {
    vi.mocked(findAll).mockImplementationOnce(() => {
      throw new Error('disk on fire')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await request(app).get('/api/snippets')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Something went wrong' })
    expect(res.text).not.toContain('disk on fire')
    expect(res.text).not.toContain('snippetRepository')
    expect(consoleError).toHaveBeenCalled()
  })
})

describe('GET /api/snippets/:id', () => {
  it('returns the snippet', async () => {
    const created = await createSnippet(codeSnippet)

    const res = await request(app).get(`/api/snippets/${created.body.id}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(created.body)
  })

  it.each(['999', 'abc', '0', '-1', '1.5'])('404s for id %s', async (id) => {
    const res = await request(app).get(`/api/snippets/${id}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Snippet not found' })
  })
})

describe('PUT /api/snippets/:id', () => {
  it('re-runs analysis when content changes', async () => {
    const created = await createSnippet(codeSnippet)
    expect(created.body.category).toBe('Code')

    const res = await request(app)
      .put(`/api/snippets/${created.body.id}`)
      .send({ content: todoSnippet.content })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe(codeSnippet.title)
    expect(res.body.content).toBe(todoSnippet.content)
    expect(res.body.category).toBe('Todo')
  })

  it('re-runs analysis when only the title changes', async () => {
    const created = await createSnippet({ title: 'Notes', content: 'Quick notes for the team' })
    expect(created.body.category).toBe('Other')

    const res = await request(app)
      .put(`/api/snippets/${created.body.id}`)
      .send({ title: 'Standup notes' })

    expect(res.status).toBe(200)
    expect(res.body.category).toBe('Meeting')
    expect(res.body.keywords).toContain('standup')
  })

  it("doesn't re-analyse when nothing actually changed", async () => {
    const created = await createSnippet(todoSnippet)
    vi.mocked(analyze).mockClear()

    const res = await request(app)
      .put(`/api/snippets/${created.body.id}`)
      .send({ title: todoSnippet.title })

    expect(res.status).toBe(200)
    expect(analyze).not.toHaveBeenCalled()
    expect(res.body.category).toBe('Todo')
  })

  it('404s for a missing snippet', async () => {
    const res = await request(app).put('/api/snippets/999').send({ title: 'New title' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Snippet not found' })
  })

  it('400s when neither field is sent', async () => {
    const created = await createSnippet(todoSnippet)

    const res = await request(app).put(`/api/snippets/${created.body.id}`).send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Provide a title or content to update' })
  })
})

describe('POST /api/snippets/:id/analyze', () => {
  it('re-analyses a snippet on demand', async () => {
    // save it without analysis first, so the endpoint has something to fill in
    vi.mocked(analyze).mockRejectedValueOnce(new Error('analyzer down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const created = await createSnippet(codeSnippet)
    expect(created.body.category).toBeNull()

    const res = await request(app).post(`/api/snippets/${created.body.id}/analyze`)

    expect(res.status).toBe(200)
    expect(res.body.category).toBe('Code')
    expect(res.body.keywords.length).toBeGreaterThan(0)
  })

  it('404s for a missing snippet', async () => {
    const res = await request(app).post('/api/snippets/999/analyze')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Snippet not found' })
  })
})

describe('DELETE /api/snippets/:id', () => {
  it('deletes the snippet, then 404s', async () => {
    const created = await createSnippet(todoSnippet)

    const first = await request(app).delete(`/api/snippets/${created.body.id}`)
    expect(first.status).toBe(204)

    const second = await request(app).delete(`/api/snippets/${created.body.id}`)
    expect(second.status).toBe(404)

    const get = await request(app).get(`/api/snippets/${created.body.id}`)
    expect(get.status).toBe(404)
  })
})
