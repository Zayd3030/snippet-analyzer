export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' })
}

// express only treats this as an error handler because it takes 4 arguments, so next has to stay
export function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' })
  }

  // body-parser marks client mistakes (like a body that's too large) as safe to expose
  if (err.expose && err.status < 500) {
    return res.status(err.status).json({ error: err.message })
  }

  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
}
