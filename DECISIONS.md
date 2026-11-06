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
