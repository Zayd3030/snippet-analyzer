import express from 'express'
import snippetsRouter from './routes/snippets.js'

const app = express()

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/snippets', snippetsRouter)

export default app
