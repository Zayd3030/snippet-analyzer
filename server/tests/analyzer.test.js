import { describe, expect, it } from 'vitest'
import { analyze } from '../src/services/analysis/index.js'
import {
  analyzeSentiment,
  countWords,
  detectCategory,
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
})

describe('category', () => {
  it('detects code', () => {
    const text = [
      'const total = items.reduce((sum, item) => sum + item.price, 0);',
      'console.log(total);',
    ].join('\n')
    expect(detectCategory(text)).toBe('Code')
  })

  it('detects a python function with no braces or semicolons', () => {
    const text = [
      'def total_price(items):',
      '    total = 0',
      '    for item in items:',
      '        total += item.price',
      '    return total',
    ].join('\n')
    expect(detectCategory(text)).toBe('Code')
  })

  it("doesn't treat a prose line ending in a colon as code", () => {
    expect(detectCategory('Agenda: release plan')).not.toBe('Code')
  })

  it('detects a todo list', () => {
    const text = [
      'Weekend errands',
      '- [ ] buy groceries',
      '- [ ] pay the electricity bill',
      '- [x] book dentist appointment',
    ].join('\n')
    expect(detectCategory(text)).toBe('Todo')
  })

  it('detects meeting notes', () => {
    const text =
      'Weekly sync with the design team. Discussed the new onboarding flow and agreed to ship it next sprint.'
    expect(detectCategory(text)).toBe('Meeting')
  })

  it('detects an idea', () => {
    const text =
      'What if the app suggested tags as you type? Could be a nice side project to prototype over the holidays.'
    expect(detectCategory(text)).toBe('Idea')
  })

  it('returns Other when nothing matches', () => {
    expect(detectCategory('Lovely walk along the river this morning, the leaves are finally turning.')).toBe(
      'Other',
    )
  })

  it('returns Other when only a weak signal matches', () => {
    // "maybe" is a weight-1 Idea signal, below MIN_SCORE on its own
    expect(detectCategory('Maybe pick up some flowers on the way home.')).toBe('Other')
  })

  it('breaks a tie using the priority order', () => {
    // "idea" scores 3 for Idea and "retro" scores 3 for Meeting, Meeting comes first in the order
    expect(detectCategory('Idea from the retro: rotate who writes the release notes.')).toBe('Meeting')
  })

  it('keeps meeting notes as Meeting even with action items and bullets', () => {
    const text = [
      'Sprint planning meeting, Tuesday 10am',
      'Attendees: Sam, Priya, Lee',
      '- Agreed to move the launch to next week',
      'Action items:',
      '- Sam: need to fix the login bug by Friday',
      '- Priya to send the updated mockups',
    ].join('\n')
    expect(detectCategory(text)).toBe('Meeting')
  })

  it('counts a repeated signal only once', () => {
    // five "maybe"s would reach MIN_SCORE if each one added to the score
    expect(detectCategory('Maybe the beach, maybe the mountains, maybe just stay home. Maybe, maybe.')).toBe(
      'Other',
    )
  })

  it('does not treat an English "select ... from" sentence as SQL', () => {
    expect(detectCategory('Please select a date from the calendar')).not.toBe('Code')
  })

  it.each(['select * from users where active = 1', 'select id, email from users'])(
    'detects lowercase SQL as code (%j)',
    (text) => {
      expect(detectCategory(text)).toBe('Code')
    },
  )

  it('does not treat code keywords in plain English as code', () => {
    // "let me know" used to score as a code keyword
    expect(detectCategory('We need to deploy the new pricing page, let me know')).not.toBe('Code')
  })

  it('does not treat "sync" on its own as a meeting', () => {
    expect(detectCategory('Need to sync my phone with the laptop')).not.toBe('Meeting')
  })
})
