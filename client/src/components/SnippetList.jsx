import SnippetCard from './SnippetCard.jsx'

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
const SKELETON_COUNT = 6

function SkeletonCard() {
  return (
    <li className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <div className="animate-pulse space-y-3 motion-reduce:animate-none">
        <div className="h-5 w-2/3 rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-slate-200" />
          <div className="h-5 w-20 rounded-full bg-slate-200" />
        </div>
        <div className="space-y-2">
          <div className="h-3 rounded bg-slate-200" />
          <div className="h-3 rounded bg-slate-200" />
          <div className="h-3 w-4/5 rounded bg-slate-200" />
        </div>
        <div className="h-3 w-1/3 rounded bg-slate-200" />
      </div>
    </li>
  )
}

function SnippetList({ snippets, status, error, onRetry }) {
  if (status === 'loading') {
    return (
      <>
        <p className="sr-only" role="status">
          Loading snippets…
        </p>
        <ul className={GRID} aria-busy="true" aria-hidden="true">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      </>
    )
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-white p-6 text-center">
        <h2 className="font-semibold">Couldn't load snippets</h2>
        <p className="mt-1 text-sm text-slate-600">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Retry
        </button>
      </div>
    )
  }

  if (snippets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="font-semibold">No snippets yet</h2>
        <p className="mt-1 text-sm text-slate-600">
          Snippets you add will show up here, tagged with a category, sentiment and keywords.
        </p>
      </div>
    )
  }

  return (
    <ul className={GRID}>
      {snippets.map((snippet) => (
        <li key={snippet.id}>
          <SnippetCard snippet={snippet} />
        </li>
      ))}
    </ul>
  )
}

export default SnippetList
