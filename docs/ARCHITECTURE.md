# Architecture

A 5-minute tour of the TaskFlow codebase.

## Goals and non-goals

**Goals**

- Run anywhere Node.js 18+ runs, including a Raspberry Pi.
- Be readable end-to-end in an afternoon.
- Keep dependencies minimal: one DB driver, one HTTP framework.
- Data portability: one SQLite file, easy to back up.

**Non-goals**

- Multi-tenant SaaS scale. TaskFlow is for a single user (or a small trusted team) per instance.
- Heavyweight build pipelines. The frontend is plain ES modules served as static files.

## Layout

```
src/
├── server.js          entrypoint: wires config + db + app, handles graceful shutdown
├── app.js             builds the Express app, mounts routers and middleware
├── config.js          environment variable parsing with defaults
├── logger.js          tiny leveled logger (no dependency)
├── db.js              SQLite connection + idempotent schema migration
├── middleware/
│   ├── auth.js        optional bearer-token auth
│   └── errors.js      HttpError class, 404 handler, error formatter
└── routes/
    ├── tasks.js       CRUD + reorder for the tasks table
    ├── tags.js        tag listing with usage counts
    └── portability.js export / import endpoints
public/
├── index.html         the entire UI (dialog, board, menu)
├── css/styles.css     theme variables, layout, components
└── js/
    ├── api.js         fetch wrapper
    ├── render.js      pure functions: state -> HTML
    └── app.js         event wiring, drag-and-drop, keyboard shortcuts
tests/
└── api.test.js        integration tests using node:test + fetch
```

## Data model

Three tables:

- `tasks` — one row per card, with status, priority, due date, and a numeric `position` for in-column ordering.
- `tags` — distinct tag names, lowercased.
- `task_tags` — many-to-many join.

A virtual FTS5 table (`tasks_fts`) is kept in sync via triggers and powers `q=` search. Indices on `(status, position)` keep board rendering O(log n) regardless of total task count.

## Request lifecycle

1. `express.json()` parses the body (capped at 2 MB).
2. The request logger emits a debug line.
3. `/api/*` requests pass through `requireAuth(token)`. If no token is configured this is a no-op.
4. The route handler validates input, runs the DB operation inside a transaction when multiple rows are touched, and returns JSON.
5. Errors thrown as `HttpError(status, code)` are formatted by the error handler; everything else becomes a `500` with the cause logged.

## Frontend state

There's deliberately no framework. `app.js` keeps a single `state` object (`tasks`, `query`, `editingId`) and re-renders the whole board after every mutation. With < 1000 tasks this is imperceptible and removes a class of bugs around stale local state. If you ever need partial updates, `render.js` is pure — swap in a diffing library at that point.

Drag-and-drop uses the native HTML5 API. On `drop` the client walks the DOM, computes new `(status, position)` for every card, and sends a single `POST /api/tasks/reorder`. This avoids N round-trips and keeps the server transactional.

## Testing strategy

`tests/api.test.js` boots the Express app against an in-memory SQLite database, listens on an ephemeral port, and exercises the HTTP surface with `fetch`. No mocks — the same code paths that run in production are tested. Each test resets the tables in `beforeEach`.

## Adding a feature

A typical change touches:

1. Schema in `db.js` (idempotent — `CREATE ... IF NOT EXISTS`).
2. A route in `src/routes/` plus validation.
3. A test in `tests/api.test.js`.
4. UI in `public/js/render.js` and/or `app.js`.
5. A note in `docs/API.md`.
