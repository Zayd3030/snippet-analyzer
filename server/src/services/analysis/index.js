import * as rules from './ruleBasedAnalyzer.js'

const providers = { rules }

function pickProvider() {
  const name = process.env.ANALYZER ?? 'rules'
  if (providers[name]) return providers[name]

  console.warn(`Unknown ANALYZER "${name}", falling back to rules`)
  return rules
}

const provider = pickProvider()

// async so callers always get a promise, whether the provider is sync (rules) or not (ollama later)
export async function analyze(text) {
  return provider.analyze(text)
}

// word counting doesn't depend on which provider tags the text
export { countWords } from './ruleBasedAnalyzer.js'
