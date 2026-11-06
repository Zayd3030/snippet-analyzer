# Decisions

Architectural choices, what was rejected, and why.

## SQLite driver: better-sqlite3
- **Chose:** `better-sqlite3` (synchronous API).
- **Rejected:** `sqlite3` (callback-based async).
- **Why:** SQLite queries on a local file take microseconds, so blocking the event loop briefly costs nothing at this scale. The sync API makes the repository plain functions with no callback or promise wrapping, and it's faster in practice.

## Schema setup: CREATE TABLE IF NOT EXISTS
- **Chose:** run the schema on every start with `CREATE TABLE IF NOT EXISTS`.
- **Rejected:** a migration tool or versioned migration files.
- **Why:** one table, no deployed data to evolve. Migrations become worth it once the schema changes after real data exists.

## Test database: env var instead of injection
- **Chose:** `database.js` exports `createDatabase(path)` plus a default instance built from `DB_PATH`. Tests will set `DB_PATH=':memory:'` in the vitest config.
- **Rejected:** an app factory that takes a `db` and passes it down through routes and repository.
- **Why:** same isolation from the real file with far less plumbing. Cost is one shared in-memory DB per test file, so tests clear the table between cases.

## Insert returns the row via RETURNING
- **Chose:** `INSERT ... RETURNING *`.
- **Rejected:** insert, then select by `lastInsertRowid`.
- **Why:** one statement instead of two, and the response shows exactly what was stored.

## Id checking in one place: router.param
- **Chose:** `router.param('id')` turns the id into a positive integer or returns 404, and stores it on `req.snippetId`.
- **Rejected:** parsing and checking the id inside each handler.
- **Why:** one rule for every `/:id` route. Non-numeric, zero or negative ids can never match a row, so they're a 404 (per the API contract) instead of reaching SQL.

## Partial update with a single COALESCE statement
- **Chose:** one fixed `UPDATE ... SET title = COALESCE(@title, title), ...` statement, with missing fields passed as `null`.
- **Rejected:** building the `SET` clause from whichever fields were sent.
- **Why:** the SQL stays static and prepared once. It works because validation guarantees a sent field is never `null`, so `null` always means "not sent".

## PUT as a partial update
- **Chose:** `PUT /:id` accepts `{ title?, content? }` and changes only what's sent, as the API contract in CLAUDE.md specifies.
- **Rejected:** strict PUT (full replacement), or renaming the route to PATCH.
- **Why:** it matches the contract and the client only needs one update call. Strictly, PATCH is the REST verb for partial updates. That's worth mentioning but not worth breaking the agreed contract over.

## Validation middleware also cleans the body
- **Chose:** after validating, the middleware replaces `req.body` with only `title` (trimmed) and `content` (as sent).
- **Rejected:** validating only and letting handlers or the repository trim and pick fields.
- **Why:** handlers can trust `req.body` completely. Content isn't trimmed because leading whitespace and indentation matter in code snippets. Its trimmed length is still what's checked, so whitespace-only content is rejected.

## Central error handler
- **Chose:** one error middleware. Malformed JSON → 400, other body-parser client errors keep their 4xx status, everything else is logged and returned as a generic 500. Unknown `/api` routes get a JSON 404.
- **Rejected:** try/catch in each handler, and Express's default HTML error page.
- **Why:** every error has the same `{ error }` shape, and stack traces stay in the server log instead of leaking to clients.

## Analysis providers can be sync or async
- **Chose:** `services/analysis/index.js` exposes `async analyze(text)` and calls the selected provider through it. The rule-based provider itself is synchronous.
- **Rejected:** making every provider return a Promise itself (CLAUDE.md's original wording).
- **Why:** callers always get a Promise either way, so swapping in Ollama later changes nothing upstream. The rule-based code and its unit tests stay plain synchronous functions. Unknown `ANALYZER` values log a warning and fall back to rules instead of crashing on startup.

## Category detection: weighted signals with a threshold
- **Chose:** each category has signals `{ match, weight }`, where a string matches a whole word or phrase and a RegExp matches the raw text. A matching signal adds its weight once. The highest total wins, a total below the threshold means `Other`, and ties go by a fixed priority order.
- **Rejected:** counting every occurrence of a signal, and first-match-wins rule lists.
- **Why:** counting each signal once stops long or repetitive text from winning on volume. Weights let strong signals (a code fence) outweigh weak ones (the word "function"). The fixed tie-break keeps results deterministic. The signal lists, weights, threshold and tie-break order themselves are written by the repo owner.

## Sentiment: averaged word lists with a short negation window
- **Chose:** small built-in positive and negative word lists. Score = the average of the matched words (+1 / -1), so it's always between -1 and 1. A negator flips the next sentiment word within 2 words. Labels use ±0.2 thresholds.
- **Rejected:** a sentiment library (not allowed by the spec), and normalising by total word count.
- **Why:** explainable in a minute and good enough for tagging. Averaging over matched words means a long neutral note with one "great" still reads positive rather than being diluted to zero. Known limits: no sarcasm, intensity ("good" vs "amazing"), domain context, or negation beyond the window.

## One tokenizer for sentiment and keywords
- **Chose:** a shared `tokenize()`: lowercase, Unicode letters and digits, apostrophes kept inside words, curly apostrophes normalised.
- **Rejected:** separate splitting logic per feature.
- **Why:** both features see the same words, and keeping `isn't` as one token is what lets negation and the stopword list work.
