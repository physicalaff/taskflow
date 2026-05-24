# TaskFlow REST API

Base URL: `http://localhost:3000/api`

Authentication: if `AUTH_TOKEN` is set, all requests must include `Authorization: Bearer <token>`.

All requests and responses use JSON. Timestamps are ISO 8601 strings in UTC.

## Task object

```json
{
  "id": 1,
  "title": "Write tests",
  "description": "Cover happy path and edge cases",
  "status": "todo",
  "priority": 2,
  "position": 0,
  "dueAt": "2026-06-01T00:00:00.000Z",
  "createdAt": "2026-05-24T12:00:00",
  "updatedAt": "2026-05-24T12:00:00",
  "tags": ["backend", "urgent"]
}
```

| Field       | Type     | Notes                                       |
| ----------- | -------- | ------------------------------------------- |
| status      | string   | `todo`, `doing`, or `done`                  |
| priority    | integer  | `0` (none) to `3` (high)                    |
| position    | number   | Sort order within a column (ascending)      |
| dueAt       | string?  | ISO timestamp or null                       |
| tags        | string[] | Lowercase, deduplicated by the server       |

## Endpoints

### `GET /api/tasks`

List tasks. Query parameters:

- `q` — full-text search across title and description (FTS5)
- `status` — filter by `todo` / `doing` / `done`
- `tag` — filter by tag name

Returns an array sorted by `(status, position)`.

### `GET /api/tasks/:id`

Fetch one task. Returns `404` if not found.

### `POST /api/tasks`

Create a task. Required: `title`. Optional: `description`, `status`, `priority`, `dueAt`, `tags`.

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Ship v1","priority":3,"tags":["release"]}'
```

Returns `201` with the created task.

### `PATCH /api/tasks/:id`

Partial update. Only the fields you pass are changed. To clear `dueAt`, pass `null`. To clear tags, pass an empty array.

### `DELETE /api/tasks/:id`

Delete a task. Returns `204`.

### `POST /api/tasks/reorder`

Bulk reorder/move tasks between columns. Body:

```json
{
  "items": [
    { "id": 1, "status": "doing", "position": 0 },
    { "id": 2, "status": "todo",  "position": 0 }
  ]
}
```

Returns `{ "ok": true, "count": N }`.

### `GET /api/tags`

List all tags with usage counts, sorted by frequency.

### `GET /api/export`

Export the entire database as JSON (tasks + tags). Use this for backup.

### `POST /api/import`

Import a previously exported payload.

```json
{
  "tasks": [ /* array of task objects */ ],
  "replace": false
}
```

If `replace: true`, all existing tasks are deleted before import. Otherwise the imported tasks are appended.

## Error format

All errors return JSON in the shape:

```json
{ "error": "title_required", "details": null }
```

| Status | Meaning                                |
| ------ | -------------------------------------- |
| 400    | Validation failed                      |
| 401    | Missing or invalid auth token          |
| 404    | Resource not found                     |
| 500    | Server error (check logs)              |
