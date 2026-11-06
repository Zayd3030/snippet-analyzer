import { describe, expect, it } from 'vitest'
import { analyze } from '../src/services/analysis/index.js'
import {
  analyzeSentiment,
  countWords,
  extractKeywords,
} from '../src/services/analysis/ruleBasedAnalyzer.js'

const CATEGORIES = ['Idea', 'Code', 'Todo', 'Meeting', 'Other']

describe('sentiment', () => {
  it('labels positive text', () => {
    expect(analyzeSentiment('I love this, the new setup is great')).toEqual({
      score: 1,
      label: 'positive',
    })
  })

  it('labels negative text', () => {
    expect(analyzeSentiment('The build is broken and the tests are slow').label).toBe('negative')
  })

  it('labels text without sentiment words as neutral', () => {
    expect(analyzeSentiment('The meeting moved to Thursday at 3pm')).toEqual({
      score: 0,
      label: 'neutral',
    })
  })

  it('labels mixed text as neutral', () => {
    expect(analyzeSentiment('good start but a bad ending').label).toBe('neutral')
  })

  it('flips a word straight after a negator', () => {
    expect(analyzeSentiment('This is not good').label).toBe('negative')
    expect(analyzeSentiment("It isn't bad at all").label).toBe('positive')
  })

  it('flips a word within two words of the negator', () => {
    expect(analyzeSentiment('This is not very good').label).toBe('negative')
  })

  it('stops flipping once the negation window has passed', () => {
    expect(analyzeSentiment('not that it matters, good').label).toBe('positive')
  })

  it('handles curly apostrophes in negators', () => {
    expect(analyzeSentiment('It isn’t good').label).toBe('negative')
  })

  it('keeps the score between -1 and 1', () => {
    const { score } = analyzeSentiment('bad bad terrible awful broken')
    expect(score).toBe(-1)
  })
})

describe('keywords', () => {
  it('removes stopwords, short words and numbers', () => {
    expect(extractKeywords('The cat and a dog sat on it in 2024')).toEqual(['cat', 'dog', 'sat'])
  })

  it('returns at most five keywords', () => {
    const text = 'alpha bravo charlie delta echo foxtrot golf hotel'
    expect(extractKeywords(text)).toHaveLength(5)
  })

  it('orders by frequency, breaking ties by first appearance', () => {
    const text = 'zebra apple mango apple zebra kiwi apple lemon grape'
    expect(extractKeywords(text)).toEqual(['apple', 'zebra', 'mango', 'kiwi', 'lemon'])
  })

  it('ignores case and punctuation', () => {
    expect(extractKeywords('Deploy! deploy, DEPLOY? Server... server')).toEqual([
      'deploy',
      'server',
    ])
  })
})

describe('word count', () => {
  it('counts words separated by single spaces', () => {
    expect(countWords('one two three')).toBe(3)
  })

  it('ignores extra spaces, tabs and line breaks', () => {
    expect(countWords('  one   two\t\tthree\n\nfour\r\n five  ')).toBe(5)
  })
})

describe('analyze', () => {
  it('returns a promise with the full result shape', async () => {
    const result = analyze('Great idea for the app')
    expect(result).toBeInstanceOf(Promise)

    const { category, sentiment, keywords, wordCount } = await result
    expect(CATEGORIES).toContain(category)
    expect(sentiment).toEqual({ score: expect.any(Number), label: 'positive' })
    expect(keywords).toEqual(['great', 'idea', 'app'])
    expect(wordCount).toBe(5)
  })

  it.each(['', '   \n\t  '])('handles empty or whitespace-only text (%j)', async (text) => {
    await expect(analyze(text)).resolves.toEqual({
      category: 'Other',
      sentiment: { score: 0, label: 'neutral' },
      keywords: [],
      wordCount: 0,
    })
  })

  // placeholder until the category rules exist
  it('returns one of the allowed categories', async () => {
    const { category } = await analyze('Remember to email the team about the release')
    expect(CATEGORIES).toContain(category)
  })
})
