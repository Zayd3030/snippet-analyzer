import { STOPWORDS } from './stopwords.js'

// weights: 4-5 = basically proof, 2-3 = strong hint, 1 = could be anything
// grouped regexes on purpose, a group scores once so related words don't stack
const CATEGORY_SIGNALS = {
  Idea: [
    { match: /\b(idea|what if|how about|could we|we could|imagine)\b/i, weight: 3 },
    { match: /\b(concept|pitch|brainstorm|prototype|side project)\b/i, weight: 2 },
    { match: /\b(maybe|might|possibly)\b/i, weight: 1 },
  ],
  Code: [
    { match: /```/, weight: 5 },
    { match: /=>/, weight: 3 },
    { match: /console\.log|print\(|\bselect\s+(\*|[\w.]+(\s*,\s*[\w.]+)*)\s+from\s+\w+/i, weight: 3 }, // select needs * or a column list, so "select a date from" doesn't count
    { match: /[{};]\s*$/m, weight: 2 }, // lines ending in { } or ;
    { match: /\b(const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|\bdef\s+\w+\(|^\s*(import|export)\s/m, weight: 2 }, // keywords only count in code-like context, "let me know" is english
    { match: /\b(bug|error|api|endpoint|refactor|deploy)\b/i, weight: 1 },
  ],
  Todo: [
    { match: /^\s*[-*]\s*\[[ x]\]/im, weight: 5 }, // markdown checkboxes
    { match: /\b(todo|to-do)\b/i, weight: 4 },
    { match: /\b(need to|have to|remember to|don't forget)\b/i, weight: 3 },
    { match: /\b(by|before) (today|tonight|tomorrow|eod|monday|tuesday|wednesday|thursday|friday)\b/i, weight: 2 },
    { match: /\b(buy|call|email|book|pay|send|fix|finish)\b/i, weight: 1 },
    { match: /^\s*([-*]|\d+\.)\s+/m, weight: 1 }, // plain bullets, weak since meeting notes use them too
  ],
  Meeting: [
    { match: /\b(agenda|minutes|attendees|action items?)\b/i, weight: 4 },
    { match: /\b(meeting|standup|stand-up|catch-up|1:1|retro)\b/i, weight: 3 },
    { match: /\b(sync|call with)\b/i, weight: 2 }, // too ambiguous for 3, "sync my phone" isn't a meeting
    { match: /\b(discussed|agreed|decided|follow up|next steps)\b/i, weight: 2 },
    { match: /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i, weight: 1 },
    { match: /\b(monday|tuesday|wednesday|thursday|friday)\b/i, weight: 1 },
  ],
}

// below this it's not confident enough to call, so it's Other
const MIN_SCORE = 3

// most specific first, code patterns are rarely accidental, "maybe" is everywhere
const TIE_BREAK_ORDER = ['Code', 'Meeting', 'Todo', 'Idea']

const POSITIVE = new Set([
  'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'lovely', 'like', 'happy', 'nice', 'fun',
  'fantastic', 'wonderful', 'best', 'better', 'easy', 'clean', 'fast', 'success', 'successful',
  'works', 'fixed', 'solved', 'helpful', 'useful', 'glad', 'excited', 'perfect',
])

const NEGATIVE = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'worse', 'sad', 'angry', 'annoying',
  'broken', 'bug', 'bugs', 'crash', 'crashes', 'error', 'errors', 'fail', 'failed', 'failing',
  'slow', 'messy', 'hard', 'difficult', 'problem', 'issue', 'stuck', 'wrong',
])

const NEGATORS = new Set([
  'not', 'no', 'never', 'none', 'nothing', 'hardly', "isn't", "aren't", "wasn't", "weren't",
  "don't", "doesn't", "didn't", "can't", 'cannot', "won't", "wouldn't", "shouldn't", "couldn't",
])

// how many words after a negator can still be flipped, so "not very good" counts as negative
const NEGATION_WINDOW = 2
const SENTIMENT_THRESHOLD = 0.2
const KEYWORD_LIMIT = 5
const MIN_KEYWORD_LENGTH = 3

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// lookarounds instead of \b so phrases that start or end with symbols (like "c++") still match
function compileSignal({ match, weight }) {
  const pattern =
    match instanceof RegExp
      ? match
      : new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(match)}(?![\\p{L}\\p{N}])`, 'iu')
  return { pattern, weight }
}

const compiledSignals = Object.entries(CATEGORY_SIGNALS).map(([category, signals]) => ({
  category,
  signals: signals.map(compileSignal),
}))

function tieBreakRank(category) {
  const index = TIE_BREAK_ORDER.indexOf(category)
  return index === -1 ? TIE_BREAK_ORDER.length : index
}

function tokenize(text) {
  // keeps apostrophes inside words so "isn't" stays one token for the negation check
  return text.toLowerCase().replaceAll('’', "'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? []
}

export function detectCategory(text) {
  const scores = compiledSignals.map(({ category, signals }) => ({
    category,
    // search() ignores lastIndex, so a /g flag on a pattern can't make matches flaky.
    // each signal counts once, so repeating a word doesn't keep adding to the score
    score: signals.reduce(
      (total, { pattern, weight }) => (text.search(pattern) === -1 ? total : total + weight),
      0,
    ),
  }))

  const best = Math.max(...scores.map(({ score }) => score))
  if (best <= 0 || best < MIN_SCORE) return 'Other'

  // sort is stable, so categories missing from the tie-break order keep their declared order
  const tied = scores.filter(({ score }) => score === best)
  tied.sort((a, b) => tieBreakRank(a.category) - tieBreakRank(b.category))
  return tied[0].category
}

export function analyzeSentiment(text) {
  let sum = 0
  let hits = 0
  let negationLeft = 0

  for (const token of tokenize(text)) {
    if (NEGATORS.has(token)) {
      negationLeft = NEGATION_WINDOW
      continue
    }

    let value = POSITIVE.has(token) ? 1 : NEGATIVE.has(token) ? -1 : 0
    if (value !== 0) {
      if (negationLeft > 0) value = -value
      negationLeft = 0
      sum += value
      hits += 1
    } else if (negationLeft > 0) {
      negationLeft -= 1
    }
  }

  // average of the matched words, so it's always between -1 and 1
  const score = hits === 0 ? 0 : Math.round((sum / hits) * 100) / 100
  const label =
    score > SENTIMENT_THRESHOLD ? 'positive' : score < -SENTIMENT_THRESHOLD ? 'negative' : 'neutral'

  return { score, label }
}

export function extractKeywords(text) {
  const counts = new Map()

  for (const token of tokenize(text)) {
    if (token.length < MIN_KEYWORD_LENGTH || STOPWORDS.has(token) || /^\p{N}+$/u.test(token)) {
      continue
    }
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  // Map keeps insertion order and sort is stable, so ties stay in first-appearance order
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEYWORD_LIMIT)
    .map(([word]) => word)
}

export function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length
}

export function analyze(text) {
  return {
    category: detectCategory(text),
    sentiment: analyzeSentiment(text),
    keywords: extractKeywords(text),
    wordCount: countWords(text),
  }
}
