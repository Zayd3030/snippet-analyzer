import { Router } from 'express'
import { create, findAll, findById, remove, update } from '../db/snippetRepository.js'
import { validateCreate, validateUpdate } from '../middleware/validateSnippet.js'

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
  res.json(findAll())
})

router.post('/', validateCreate, (req, res) => {
  res.status(201).json(create(req.body))
})

router.get('/:id', (req, res) => {
  const snippet = findById(req.snippetId)
  if (!snippet) return sendNotFound(res)
  res.json(snippet)
})

router.put('/:id', validateUpdate, (req, res) => {
  const snippet = update(req.snippetId, req.body)
  if (!snippet) return sendNotFound(res)
  res.json(snippet)
})

router.delete('/:id', (req, res) => {
  if (!remove(req.snippetId)) return sendNotFound(res)
  res.status(204).end()
})

export default router
