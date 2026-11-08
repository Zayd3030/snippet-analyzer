import { useEffect, useRef, useState } from 'react'
import { deleteSnippet, listSnippets } from './api/snippets.js'
import SnippetList from './components/SnippetList.jsx'
import SnippetModal from './components/SnippetModal.jsx'

const NOTICE_TIMEOUT_MS = 5000

function isNewer(a, b) {
  return a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.id > b.id)
}

// puts a snippet back where the server would list it (newest first), so a rollback lands in
// its old spot even if something was created while the delete was in flight
function insertInOrder(list, snippet) {
  const index = list.findIndex((s) => isNewer(snippet, s))
  return index === -1 ? [...list, snippet] : [...list.slice(0, index), snippet, ...list.slice(index)]
}

function App() {
  const [snippets, setSnippets] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  // bumping this re-runs the fetch effect, so retry shares the same abort handling
  const [reloadKey, setReloadKey] = useState(0)
  // null when closed, otherwise { mode: 'create' } or { mode: 'edit', snippet }
  const [modal, setModal] = useState(null)
  // one notice at a time, a new one replaces the old
  const [notice, setNotice] = useState(null)
  const newButtonRef = useRef(null)
  // a ref, not state, so a second click is blocked even before react re-renders
  const deletingIds = useRef(new Set())

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

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [notice])

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

  // the neighbouring cards stay mounted, so focus can move before this one disappears
  // and never drops to the page body
  function moveFocusAwayFrom(id) {
    const index = snippets.findIndex((s) => s.id === id)
    const neighbour = snippets[index + 1] ?? snippets[index - 1]
    const target = neighbour ? document.getElementById(`snippet-${neighbour.id}-edit`) : null
    ;(target ?? newButtonRef.current).focus()
  }

  // optimistic: the card goes straight away and only comes back if the server says no
  async function handleDelete(snippet) {
    if (deletingIds.current.has(snippet.id)) return
    deletingIds.current.add(snippet.id)

    moveFocusAwayFrom(snippet.id)
    setSnippets((current) => current.filter((s) => s.id !== snippet.id))

    try {
      await deleteSnippet(snippet.id)
    } catch (err) {
      // 404 means it's already gone (another tab, a retried request), which is what we wanted
      if (err.status !== 404) {
        setSnippets((current) => insertInOrder(current, snippet))
        setNotice({ message: `Couldn't delete "${snippet.title}". It's been restored.` })
      }
    } finally {
      deletingIds.current.delete(snippet.id)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-lg font-semibold sm:text-xl">Snippet Analyzer</h1>
          <button
            ref={newButtonRef}
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            New snippet
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* the live region stays in the DOM so screen readers pick up content added to it */}
        <div role="status" aria-live="polite">
          {notice && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p>{notice.message}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-800"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        <SnippetList
          snippets={snippets}
          status={status}
          error={error}
          onRetry={handleRetry}
          onEdit={(snippet) => setModal({ mode: 'edit', snippet })}
          onSaved={handleSaved}
          onDelete={handleDelete}
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
