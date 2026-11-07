const BASE_URL = '/api/snippets'

async function request(path = '', { method = 'GET', body, signal } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  // DELETE returns 204 with no body, so there's nothing to parse
  if (response.status === 204) return null

  // the body can be empty or not JSON, e.g. the vite proxy's 500 when the server is down
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status})`)
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
