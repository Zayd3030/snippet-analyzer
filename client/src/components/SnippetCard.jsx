import AnalysisBadges from './AnalysisBadges.jsx'

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

function SnippetCard({ snippet }) {
  const { title, content, category, sentimentLabel, sentimentScore, keywords, wordCount, createdAt } =
    snippet
  const preview = truncatePreview(content)

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <h2 className="font-semibold break-words">{title}</h2>

      <AnalysisBadges category={category} sentimentLabel={sentimentLabel} sentimentScore={sentimentScore} />

      {category === 'Code' ? (
        <pre className="overflow-hidden rounded bg-slate-50 p-2 font-mono text-xs whitespace-pre-wrap break-words text-slate-700">
          {preview}
        </pre>
      ) : (
        <p className="text-sm break-words text-slate-600">{preview}</p>
      )}

      {keywords.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Keywords">
          {keywords.slice(0, 5).map((keyword) => (
            <li key={keyword} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
              {keyword}
            </li>
          ))}
        </ul>
      )}

      {/* mt-auto keeps the footer at the bottom when cards in a row have different heights */}
      <footer className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-slate-500">
        {wordCount != null ? <span>{wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}</span> : <span />}
        <time dateTime={createdAt} title={new Date(createdAt).toLocaleString()}>
          {formatRelativeTime(createdAt)}
        </time>
      </footer>
    </article>
  )
}

export default SnippetCard
