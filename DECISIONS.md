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

## snippetService between routes and repository
- **Chose:** `services/snippetService.js` owns "analyse then save". Routes call only the service; the service calls the repository and the analysis module.
- **Rejected:** calling `analyze()` from route handlers, or from inside the repository.
- **Why:** handlers stay as validate → call → respond, and the repository stays pure SQL. The rules about when to analyse, what text to analyse and what to do when it fails live in one testable place.

## Analyse before writing
- **Chose:** run analysis first, then a single insert (or update) that includes the analysis columns.
- **Rejected:** insert the snippet, then update it with analysis afterwards.
- **Why:** one write instead of two, and there's never a moment where a row exists without the analysis it should have.

## Analysis failure doesn't fail the save
- **Chose:** if the analyzer throws, log it and save with null analysis fields. `POST /:id/analyze` can fill them in later.
- **Rejected:** returning a 500 and dropping the write.
- **Why:** the note is the user's data, the tags are a derived extra. Losing someone's text because tagging failed would be the worse bug.

## Title is part of the analysed text, word count isn't
- **Chose:** analyse `title + "\n" + content`, then replace `wordCount` with a count of the content alone. Done in the service, analyzer interface unchanged.
- **Rejected:** analysing content only, or counting title words too.
- **Why:** a title like "Standup notes" is often the strongest category hint. Word count is shown to the user as the size of what they wrote, so the title shouldn't inflate it.

## Re-analyse when the title changes too
- **Chose:** on update, re-analyse if the title **or** content differs from what's stored. Sending identical text skips analysis.
- **Rejected:** content-only (CLAUDE.md's original wording).
- **Why:** follows from including the title in the analysed text. Renaming a note to "Meeting notes" should be able to change its category.

## Separate update statement when analysis is written
- **Chose:** a second prepared `UPDATE` that sets title, content and every analysis column explicitly, used whenever analysis ran.
- **Rejected:** extending the COALESCE statement to the analysis columns.
- **Why:** COALESCE treats null as "keep the old value", but a failed re-analysis needs to write null so stale tags from the old text don't stick around.

## Test mocks wrap the real modules
- **Chose:** `vi.mock` replaces `analyze` and `findAll` with `vi.fn(realImplementation)`, and failure tests override them once.
- **Rejected:** dependency injection through the app, or separate test files per mock.
- **Why:** every other test exercises the real code path, and the two failure tests need no extra plumbing in the app.

## Client API module with one request helper
- **Chose:** `client/src/api/snippets.js` has a single `request()` that calls fetch, handles 204, parses JSON, and throws an `Error` carrying the server's `{ error }` message. One tiny exported function per endpoint.
- **Rejected:** calling `fetch` from components, or adding a client like axios.
- **Why:** components get plain data or a readable error and never deal with status codes. URLs and error handling live in one file. Fetch is enough for six endpoints.

## Fetch on mount: AbortController in the effect
- **Chose:** the effect creates an `AbortController` and aborts it in cleanup; `AbortError` is ignored.
- **Rejected:** an `ignore` flag (only discards the result, the request still runs), and a `useRef` guard that skips the second StrictMode run (fights StrictMode instead of being cleanup-safe).
- **Why:** StrictMode's mount → unmount → mount cancels the first request, so only one response is handled and nothing sets state after unmount. Dev tools still show two requests, the first cancelled. Production only runs once.

## One status field instead of booleans
- **Chose:** `status` is `'loading' | 'error' | 'ready'`.
- **Rejected:** separate `isLoading` and `isError` booleans.
- **Why:** booleans allow impossible combinations (loading and errored at once). One field means the list renders exactly one state.

## Retry by re-running the effect
- **Chose:** Retry sets status to `'loading'` and bumps a `reloadKey` that the fetch effect depends on.
- **Rejected:** a separate fetch function called from the button.
- **Why:** one fetch code path, so retry gets the same abort handling for free. Setting loading in the click handler avoids setting state synchronously inside the effect.

## Preview truncated on the client
- **Chose:** cards cut content to ~150 chars at the last whitespace and add an ellipsis.
- **Rejected:** a `preview` field computed by the server.
- **Why:** the full content is already in the response (the edit modal needs it), and preview length is a display concern that may differ per screen.

## Modal: native <dialog> with showModal()
- **Chose:** a `<dialog>` opened with `showModal()`. The browser makes the rest of the page inert (focus can't leave), handles Escape via the `cancel` event, draws `::backdrop`, puts it in the top layer and returns focus to the opening button on close.
- **Rejected:** a custom modal (a fixed div plus a hand-written focus trap, Escape listener, scroll handling and `aria-modal`), or a library.
- **Why:** less code and fewer accessibility bugs. Costs: it's imperative (a ref and an effect instead of an `open` prop), backdrop clicks need manual handling, open/close animations are harder, and Chrome may skip the `cancel` event on a repeated Escape with no user interaction in between, which closes the modal without the unsaved-changes confirm. Acceptable for an internal tool.
- `showModal()` runs once on mount with no `close()` in cleanup. StrictMode's fake unmount would otherwise queue a `close` event and shut the modal straight away in dev.

## Modal state is one value, mounted only while open
- **Chose:** `modal` in App is `null`, `{ mode: 'create' }` or `{ mode: 'edit', snippet }`. The modal component only exists while it's open.
- **Rejected:** separate `isOpen`, `mode` and `editingSnippet` state, and an always-mounted modal that resets its own form.
- **Why:** no impossible combinations, and every open starts from fresh form state without a reset effect.

## Update the list from the API response
- **Chose:** create, update and re-analyse return the saved snippet, and App upserts it into `snippets` (replace by id, otherwise prepend).
- **Rejected:** refetching the whole list after each change.
- **Why:** one request instead of two, no loading flash, and scroll position stays put. It's safe because the server response is the stored row, so local state can't drift from it. A refetch would only matter with multiple users editing at once.

## Client validation duplicates the server limits
- **Chose:** the modal copies the server's rules (trimmed length, required, 120 / 10,000) and its exact messages for instant feedback. Server errors are still shown as they come back.
- **Rejected:** server-only validation, or sharing the limits through a package or a `/limits` endpoint.
- **Why:** the server stays the source of truth, so a mismatch can only cause an extra round trip, never bad data. Two small, stable numbers don't justify shared-code plumbing in a two-app repo. The cost is remembering to change both places.

## Show the analysis in the modal after save
- **Chose:** on save the modal switches to a result view (category shown large, sentiment, keywords, word count) with Done and Edit buttons. Focus moves to Done.
- **Rejected:** closing the modal and relying on the new card's badges.
- **Why:** the brief asks for the classification to be visible immediately. A result view makes the tag the thing you look at, not something to spot in a grid. If analysis failed, it says so and points to Re-analyse.

## Re-analyse state lives on the card
- **Chose:** each card tracks its own `reanalysing` and error state, calls `analyzeSnippet`, and hands the result to App's upsert.
- **Rejected:** a map of busy ids in App.
- **Why:** only that card needs to know it's busy. App still owns the snippet data.

## Sentiment measures mood, not topic
- **Chose:** the word lists only hold words that express how the writer feels. Removed topic words: bug(s), error(s), crash(es), fail/failed/failing, issue, problem from negative, and fixed, solved, works, clean, fast, like from positive. Added everyday mood words (thanks, enjoyed, proud, smooth / frustrated, worried, tired, confusing and similar).
- **Rejected:** keeping tech words and weighting them lower, or separate word lists per category.
- **Why:** in a snippet tool, "bug" or "error" usually says what a note is about, not how the writer feels, so every dev note read as negative. "like" was also mostly a preposition ("looks like a timeout"). Broken, slow and hard stay, because they still read as complaints in most contexts.

## Python block lines as a Code signal
- **Chose:** a weight-2 Code signal for a line that starts with a Python block keyword (def, class, for, if, elif, else, while, try, except, with) and ends in a colon. Case-sensitive.
- **Rejected:** a bare "line ends in a colon" signal, or raising the weight of the existing `def name(` signal.
- **Why:** Python has no braces or semicolons, so a plain function only hit the `def` signal (2) and fell below the threshold. Requiring the keyword at the start of the line keeps prose like "Agenda: release plan" out. Case-sensitivity skips sentences that start with "If" or "For". A lowercase prose line like "for the record:" can still match, but at weight 2 it can't make something Code on its own.

## Optimistic delete
- **Chose:** remove the card from state immediately, then call the API. On failure, put it back and show a notice.
- **Rejected:** pessimistic delete (wait for the server, then remove).
- **Why:** deletes almost always succeed and the server's answer adds nothing to show, so waiting only makes the UI feel slow. Rollback is cheap because the snippet object is still in hand. Pessimistic is the better fit when failure is common, or when the response carries data the UI needs, like the analysis on create and edit.

## 404 on delete counts as success
- **Chose:** a 404 from `DELETE /:id` leaves the snippet removed, with no notice.
- **Rejected:** treating every non-2xx as a failure and restoring.
- **Why:** the goal is "this snippet shouldn't exist", and a 404 says it doesn't, whether another tab deleted it or a retried request already did. Restoring it would bring back a card that can't be edited or deleted.

## Inline confirm instead of window.confirm
- **Chose:** Delete swaps the card's actions for "Delete this snippet?" with Confirm and Cancel. Focus goes to Cancel, and Escape backs out.
- **Rejected:** `window.confirm`.
- **Why:** the native dialog blocks the page, can't be styled, shows the site's address as its title, and some browsers let users suppress it. Inline, the confirm stays next to the thing being deleted. Focus on Cancel means a stray Enter is harmless.

## Rollback restores by sort order
- **Chose:** a failed delete re-inserts the snippet at its newest-first position (`createdAt`, then `id`).
- **Rejected:** remembering the index it was removed from.
- **Why:** the list can change while the request is in flight (a new snippet goes on top), which shifts indexes. Sort order is how the server lists them, so the card always lands where a refresh would put it.

## Delete disabled while re-analysing
- **Chose:** a card's Delete button is disabled while its re-analyse request is running. Re-analyse is hidden while the delete confirm is showing.
- **Rejected:** allowing both at once.
- **Why:** a re-analyse response arriving after the delete would go through App's upsert, see an unknown id and add the deleted snippet back.

## Focus moves before the card is removed
- **Chose:** focus jumps to the next card's Edit button (or the previous card's, or "New snippet" when the list is empty) before the deleted card leaves state. That target is found by element id.
- **Rejected:** letting focus fall to `<body>`, or a ref map for every card's buttons.
- **Why:** keyboard and screen-reader users keep their place in the list. The neighbouring cards stay mounted, so their buttons can be focused straight away. One id lookup is simpler than keeping a ref per card.

## Optional .env with defaults in code
- **Chose:** server scripts use `node --env-file-if-exists=.env`. Every variable already has a default in code (`PORT` 3001, `DB_PATH` ./data/snippets.db, `ANALYZER` rules), and `database.js` creates the data folder.
- **Rejected:** `--env-file=.env` (Node exits if the file is missing), a postinstall script that copies `.env.example`, and adding `dotenv`.
- **Why:** a fresh clone runs with zero config, no extra dependency. `.env` is only for overriding defaults.

## Node 22.12 minimum
- **Chose:** `"engines": { "node": ">=22.12.0" }` in both package.json files.
- **Rejected:** `>=22` (what better-sqlite3 alone asks for).
- **Why:** the strictest dependency sets the floor. vitest 5, vite 8 and oxlint all need 22.12+, and `--env-file-if-exists` needs 22.9+. One number for both apps is easier to state in the README.

## Unreachable server detected by an empty 5xx
- **Chose:** the client API module shows "Can't reach the server…" when fetch itself throws, or when a 500/502/503/504 comes back with no JSON body. Any response with an `{ error }` body keeps the server's message.
- **Rejected:** treating every 5xx as "unreachable", or showing the raw status.
- **Why:** when the server is down, the Vite proxy answers with an empty 502 (checked against Vite 8, older versions sent 500), which reads like a server bug to the user. Our server always sends `{ error }` with its own 500s, so the missing body is what tells the two apart.

## Long words wrap anywhere, single-column grid is explicit
- **Chose:** `wrap-anywhere` on card titles, previews, keywords and the delete notice, and `grid-cols-1` as the base grid.
- **Rejected:** `break-words`, and clamping titles.
- **Why:** `break-words` doesn't lower an element's minimum width, so on phones the implicit `auto` grid column grew to fit a long URL or token and the card overflowed the screen. `grid-cols-1` is `minmax(0, 1fr)`, so the column can't grow. Titles are capped at 120 chars, so wrapping is enough.
