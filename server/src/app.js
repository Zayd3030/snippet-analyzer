import express from 'express'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import snippetsRouter from './routes/snippets.js'

const app = express()

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/snippets', snippetsRouter)
app.use('/api', notFound)

app.use(errorHandler)

export default app
