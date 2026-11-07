// full class strings on purpose, tailwind only generates classes it can find written out
const CATEGORY_STYLES = {
  Idea: 'bg-amber-50 text-amber-800 ring-amber-200',
  Code: 'bg-sky-50 text-sky-800 ring-sky-200',
  Todo: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Meeting: 'bg-violet-50 text-violet-800 ring-violet-200',
  Other: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const SENTIMENT_STYLES = {
  positive: { label: 'Positive', dot: 'bg-emerald-500' },
  neutral: { label: 'Neutral', dot: 'bg-slate-400' },
  negative: { label: 'Negative', dot: 'bg-red-500' },
}

const BADGE = 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1'

// category and sentiment are null when analysis failed on save, so both have a fallback
function AnalysisBadges({ category, sentimentLabel, sentimentScore }) {
  const sentiment = SENTIMENT_STYLES[sentimentLabel]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {category ? (
        <span className={`${BADGE} ${CATEGORY_STYLES[category] ?? CATEGORY_STYLES.Other}`}>{category}</span>
      ) : (
        <span className={`${BADGE} bg-white text-slate-500 ring-slate-200`}>Not analysed</span>
      )}

      {sentiment && (
        <span
          className={`${BADGE} bg-white text-slate-700 ring-slate-200`}
          title={`Sentiment score ${sentimentScore.toFixed(2)}`}
        >
          <span className={`size-2 rounded-full ${sentiment.dot}`} aria-hidden="true" />
          {sentiment.label}
        </span>
      )}
    </div>
  )
}

export default AnalysisBadges
