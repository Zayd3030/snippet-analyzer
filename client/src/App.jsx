import { useEffect, useState } from 'react'
import { listSnippets } from './api/snippets.js'
import SnippetList from './components/SnippetList.jsx'

function App() {
  const [snippets, setSnippets] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  // bumping this re-runs the fetch effect, so retry shares the same abort handling
  const [reloadKey, setReloadKey] = useState(0)

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-lg font-semibold sm:text-xl">Snippet Analyzer</h1>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            New snippet
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <SnippetList snippets={snippets} status={status} error={error} onRetry={handleRetry} />
      </main>
    </div>
  )
}

export default App
