import * as repository from '../db/snippetRepository.js'
import { analyze, countWords } from './analysis/index.js'

const EMPTY_ANALYSIS = { category: null, sentiment: null, keywords: null, wordCount: null }

// title goes in too since it's often the best category hint ("Standup notes"),
// but word count should describe what the user wrote in the body
async function analyseSnippet(title, content) {
  try {
    const analysis = await analyze(`${title}\n${content}`)
    return { ...analysis, wordCount: countWords(content) }
  } catch (err) {
    // tagging is a nice extra, losing someone's note because it failed isn't ok
    console.error('Analysis failed, saving without it:', err)
    return EMPTY_ANALYSIS
  }
}

export function listSnippets() {
  return repository.findAll()
}

export function getSnippet(id) {
  return repository.findById(id)
}

export function deleteSnippet(id) {
  return repository.remove(id)
}

export async function createSnippet({ title, content }) {
  const analysis = await analyseSnippet(title, content)
  return repository.create({ title, content }, analysis)
}

export async function updateSnippet(id, changes) {
  const existing = repository.findById(id)
  if (!existing) return null

  const title = changes.title ?? existing.title
  const content = changes.content ?? existing.content

  // resending the same text shouldn't cost a re-analysis
  if (title === existing.title && content === existing.content) {
    return repository.update(id, changes)
  }

  const analysis = await analyseSnippet(title, content)
  return repository.update(id, { title, content }, analysis)
}

export async function reanalyseSnippet(id) {
  const existing = repository.findById(id)
  if (!existing) return null

  const analysis = await analyseSnippet(existing.title, existing.content)
  return repository.update(id, existing, analysis)
}
