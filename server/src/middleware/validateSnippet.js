const fields = {
  title: { label: 'Title', max: 120 },
  content: { label: 'Content', max: 10_000 },
}

function checkField(name, value) {
  const { label, max } = fields[name]

  if (typeof value !== 'string') return `${label} must be text`

  const length = value.trim().length
  if (length === 0) return `${label} can't be empty`
  if (length > max) return `${label} must be ${max.toLocaleString('en-US')} characters or fewer`

  return null
}

// title is trimmed, but content is kept as sent because indentation matters in code snippets.
// rebuilding the body also drops any fields we don't know about
function cleanBody({ title, content }) {
  const body = {}
  if (title !== undefined) body.title = title.trim()
  if (content !== undefined) body.content = content
  return body
}

export function validateCreate(req, res, next) {
  // express 5 leaves req.body undefined when the request has no JSON body
  const body = req.body ?? {}

  for (const name of Object.keys(fields)) {
    if (body[name] === undefined) {
      return res.status(400).json({ error: `${fields[name].label} is required` })
    }
    const error = checkField(name, body[name])
    if (error) return res.status(400).json({ error })
  }

  req.body = cleanBody(body)
  next()
}

export function validateUpdate(req, res, next) {
  const body = req.body ?? {}
  const present = Object.keys(fields).filter((name) => body[name] !== undefined)

  if (present.length === 0) {
    return res.status(400).json({ error: 'Provide a title or content to update' })
  }

  for (const name of present) {
    const error = checkField(name, body[name])
    if (error) return res.status(400).json({ error })
  }

  req.body = cleanBody(body)
  next()
}
