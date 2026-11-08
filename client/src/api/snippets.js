const BASE_URL = '/api/snippets'
const SERVER_UNREACHABLE = "Can't reach the server. Check it's running on port 3001."
const GATEWAY_STATUSES = new Set([500, 502, 503, 504])

async function request(path = '', { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(BASE_URL + path, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    // aborts are expected (StrictMode, unmount) and callers ignore them by name
    if (err.name === 'AbortError') throw err
    throw new Error(SERVER_UNREACHABLE)
  }

  // DELETE returns 204 with no body, so there's nothing to parse
  if (response.status === 204) return null

  // the body can be empty or not JSON, e.g. the vite proxy's 502 when the server is down
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    // our server always sends { error } with its 500s, so an empty 5xx came from the proxy
    const unreachable = data === null && GATEWAY_STATUSES.has(response.status)
    const message = unreachable ? SERVER_UNREACHABLE : (data?.error ?? `Request failed (${response.status})`)
    const error = new Error(message)
    // callers sometimes need the status itself, e.g. a 404 on delete means it's already gone
    error.status = response.status
    throw error
  }

  return data
}

export function listSnippets({ signal } = {}) {
  return request('', { signal })
}

export function getSnippet(id) {
  return request(`/${id}`)
}

export function createSnippet({ title, content }) {
  return request('', { method: 'POST', body: { title, content } })
}

export function updateSnippet(id, changes) {
  return request(`/${id}`, { method: 'PUT', body: changes })
}

export function deleteSnippet(id) {
  return request(`/${id}`, { method: 'DELETE' })
}

export function analyzeSnippet(id) {
  return request(`/${id}/analyze`, { method: 'POST' })
}
