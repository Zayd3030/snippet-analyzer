import { useEffect, useState } from 'react'
import { listSnippets } from './api/snippets.js'
import SnippetList from './components/SnippetList.jsx'
import SnippetModal from './components/SnippetModal.jsx'

function App() {
  const [snippets, setSnippets] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  // bumping this re-runs the fetch effect, so retry shares the same abort handling
  const [reloadKey, setReloadKey] = useState(0)
  // null when closed, otherwise { mode: 'create' } or { mode: 'edit', snippet }
  const [modal, setModal] = useState(null)

  useEffect(() => {
    // StrictMode mounts, unmounts and remounts in dev. Aborting on cleanup cancels the
    // first request, so only one response is ever handled and nothing updates after unmount
    const controller = new AbortController()

    listSnippets({ signal: controller.signal })
      .then((data) => {
        setSnippets(data)
        setStatus('ready')
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setStatus('error')
      })

    return () => controller.abort()
  }, [reloadKey])

  function handleRetry() {
    setStatus('loading')
    setReloadKey((key) => key + 1)
  }

  // the API returns the full saved snippet, so patch it in rather than refetching the list.
  // one upsert covers create, edit, re-analyse, and editing again straight after a create
  function handleSaved(saved) {
    setSnippets((current) =>
      current.some((s) => s.id === saved.id)
        ? current.map((s) => (s.id === saved.id ? saved : s))
        : [saved, ...current],
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-lg font-semibold sm:text-xl">Snippet Analyzer</h1>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            New snippet
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <SnippetList
          snippets={snippets}
          status={status}
          error={error}
          onRetry={handleRetry}
          onEdit={(snippet) => setModal({ mode: 'edit', snippet })}
          onSaved={handleSaved}
        />
      </main>

      {/* mounted only while open, so every open starts with a fresh form */}
      {modal && (
        <SnippetModal
          initialSnippet={modal.mode === 'edit' ? modal.snippet : null}
          onSaved={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default App
