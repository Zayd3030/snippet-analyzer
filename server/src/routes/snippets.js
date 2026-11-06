import { Router } from 'express'
import { create, findAll } from '../db/snippetRepository.js'

const router = Router()

router.get('/', (req, res) => {
  res.json(findAll())
})

router.post('/', (req, res) => {
  const { title, content } = req.body
  res.status(201).json(create({ title, content }))
})

export default router
