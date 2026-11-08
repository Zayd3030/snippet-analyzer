import { useState } from 'react'
import { analyzeSnippet } from '../api/snippets.js'
import AnalysisBadges, { KeywordTags } from './AnalysisBadges.jsx'

const ACTION =
  'rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50'

const PREVIEW_LENGTH = 150

// largest unit first, so we say "2 hours ago" rather than "7,200 seconds ago"
const TIME_UNITS = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
]

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function truncatePreview(text, max = PREVIEW_LENGTH) {
  if (text.length <= max) return text

  const cut = text.slice(0, max)
  // back up to the last whitespace so we don't end mid-word. One giant word gets a hard cut
  const lastSpace = cut.search(/\s\S*$/)
  const preview = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return `${preview.trimEnd()}…`
}

function formatRelativeTime(iso) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000

  for (const [unit, size] of TIME_UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeTime.format(Math.round(seconds / size), unit)
    }
  }
  return relativeTime.format(0, 'second')
}

function SnippetCard({ snippet, onEdit, onSaved }) {
  const { id, title, content, category, sentimentLabel, sentimentScore, keywords, wordCount, createdAt } =
    snippet
  const preview = truncatePreview(content)
  // kept on the card so only this one shows a loading state
  const [reanalysing, setReanalysing] = useState(false)
  const [reanalyseError, setReanalyseError] = useState(null)

  async function handleReanalyse() {
    setReanalysing(true)
    setReanalyseError(null)
    try {
      onSaved(await analyzeSnippet(id))
    } catch (err) {
      setReanalyseError(`Re-analyse failed: ${err.message}`)
    } finally {
      setReanalysing(false)
    }
  }

  return (
    <article
      aria-busy={reanalysing}
      className="flex h-full flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200"
    >
      <h2 className="font-semibold break-words">{title}</h2>

      <AnalysisBadges category={category} sentimentLabel={sentimentLabel} sentimentScore={sentimentScore} />

      {category === 'Code' ? (
        <pre className="overflow-hidden rounded bg-slate-50 p-2 font-mono text-xs whitespace-pre-wrap break-words text-slate-700">
          {preview}
        </pre>
      ) : (
        // pre-line keeps line breaks (todo lists, notes) but still collapses runs of spaces
        <p className="text-sm whitespace-pre-line break-words text-slate-600">{preview}</p>
      )}

      <KeywordTags keywords={keywords} />

      {/* mt-auto keeps the footer at the bottom when cards in a row have different heights */}
      <footer className="mt-auto space-y-2 pt-1">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          {wordCount != null ? <span>{wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}</span> : <span />}
          <time dateTime={createdAt} title={new Date(createdAt).toLocaleString()}>
            {formatRelativeTime(createdAt)}
          </time>
        </div>

        {reanalyseError && (
          <p role="alert" className="text-xs text-red-600">
            {reanalyseError}
          </p>
        )}

        <div className="-ml-2 flex gap-1 border-t border-slate-100 pt-2">
          <button type="button" onClick={() => onEdit(snippet)} aria-label={`Edit ${title}`} className={ACTION}>
            Edit
          </button>
          <button
            type="button"
            onClick={handleReanalyse}
            disabled={reanalysing}
            aria-label={`Re-analyse ${title}`}
            className={ACTION}
          >
            {reanalysing ? 'Analysing…' : 'Re-analyse'}
          </button>
        </div>
      </footer>
    </article>
  )
}

export default SnippetCard
