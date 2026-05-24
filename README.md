# TaskFlow

A modern, self-hosted Kanban task manager with a clean REST API, drag-and-drop UI, and zero build step. Single binary deploy, SQLite storage, runs anywhere Node.js runs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Tests](https://img.shields.io/badge/tests-passing-success)

## Why TaskFlow?

Most task managers are either bloated SaaS products that lock you in, or minimal CLI tools without a usable UI. TaskFlow sits in the middle: a small (~1500 LOC), self-hostable web app you can run on a Raspberry Pi, a VPS, or `localhost`. Your data stays in one SQLite file you can back up with `cp`.

## Features

- **Kanban boards** with drag-and-drop columns and cards
- **Tags, priorities, due dates** with smart sorting and overdue indicators
- **Full-text search** across titles and descriptions (SQLite FTS5)
- **Markdown** in descriptions, rendered safely
- **Keyboard-first** — every action has a shortcut (press `?` to view)
- **Dark / light theme** that respects system preference
- **REST API** documented in [docs/API.md](docs/API.md) — automate anything
- **Import / export** as JSON for backup or migration
- **No build step** — vanilla HTML/CSS/JS frontend, no bundler, no framework lock-in
- **Single dependency** for the server (Express) + a thin SQLite driver
- **Docker** image under 60 MB

## Quick start

```bash
git clone https://github.com/physicalaff/taskflow.git
cd taskflow
npm install
npm start
# open http://localhost:3000
```

Or with Docker:

```bash
docker build -t taskflow .
docker run -p 3000:3000 -v taskflow-data:/data taskflow
```

## Screenshots

The UI is a three-column board (To Do / Doing / Done) with inline editing, drag-and-drop reordering, and a command palette (`Cmd/Ctrl+K`).

## Configuration

Configure via environment variables:

| Variable        | Default            | Description                          |
| --------------- | ------------------ | ------------------------------------ |
| `PORT`          | `3000`             | HTTP port                            |
| `DB_PATH`       | `./data/tasks.db`  | SQLite file location                 |
| `AUTH_TOKEN`    | _(none)_           | If set, all API calls require it     |
| `LOG_LEVEL`     | `info`             | `debug`, `info`, `warn`, `error`     |

## API

A short tour — full docs in [docs/API.md](docs/API.md).

```bash
# List tasks
curl http://localhost:3000/api/tasks

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Write tests","status":"todo","priority":2}'

# Search
curl "http://localhost:3000/api/tasks?q=test&tag=backend"

# Export everything
curl http://localhost:3000/api/export > backup.json
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a 5-minute tour of the codebase. The TL;DR:

- `src/server.js` — Express app, middleware wiring
- `src/db.js` — SQLite connection, schema migrations on startup
- `src/routes/` — REST handlers, one file per resource
- `public/` — Frontend (no build step, ES modules in the browser)

## Development

```bash
npm install
npm run dev      # restart server on changes
npm test         # run the test suite
npm run lint     # check code style
```

## Roadmap

- [ ] Multi-user support with per-board ACLs
- [ ] WebSocket sync for live collaboration
- [ ] Recurring tasks
- [ ] iCalendar export for due dates
- [ ] Plugin API for custom card fields

## Contributing

Pull requests welcome. Please run `npm test` and `npm run lint` before opening a PR. Small focused PRs over large refactors.

## License

MIT — see [LICENSE](LICENSE).
