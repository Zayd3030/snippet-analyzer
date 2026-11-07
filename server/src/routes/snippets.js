import { Router } from 'express'
import { validateCreate, validateUpdate } from '../middleware/validateSnippet.js'
import {
  createSnippet,
  deleteSnippet,
  getSnippet,
  listSnippets,
  reanalyseSnippet,
  updateSnippet,
} from '../services/snippetService.js'

const router = Router()

function sendNotFound(res) {
  res.status(404).json({ error: 'Snippet not found' })
}

// runs before every route with :id. Anything that isn't a positive whole number can't
// match a row, so it's a 404 rather than letting it reach SQL
router.param('id', (req, res, next, id) => {
  const snippetId = Number(id)
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(snippetId) || snippetId < 1) {
    return sendNotFound(res)
  }
  // stored on req because req.params is rebuilt for each route and would be a string again
  req.snippetId = snippetId
  next()
})

router.get('/', (req, res) => {
  res.json(listSnippets())
})

// express 5 passes rejected promises from async handlers to the error handler
router.post('/', validateCreate, async (req, res) => {
  res.status(201).json(await createSnippet(req.body))
})

router.get('/:id', (req, res) => {
  const snippet = getSnippet(req.snippetId)
  if (!snippet) return sendNotFound(res)
  res.json(snippet)
})

router.put('/:id', validateUpdate, async (req, res) => {
  const snippet = await updateSnippet(req.snippetId, req.body)
  if (!snippet) return sendNotFound(res)
  res.json(snippet)
})

router.delete('/:id', (req, res) => {
  if (!deleteSnippet(req.snippetId)) return sendNotFound(res)
  res.status(204).end()
})

router.post('/:id/analyze', async (req, res) => {
  const snippet = await reanalyseSnippet(req.snippetId)
  if (!snippet) return sendNotFound(res)
  res.json(snippet)
})

export default router
