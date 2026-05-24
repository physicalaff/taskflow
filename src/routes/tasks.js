import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';

const STATUSES = new Set(['todo', 'doing', 'done']);

function rowToTask(row, tags) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    position: row.position,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: tags || [],
  };
}

function validateInput(body, { partial = false } = {}) {
  const out = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      throw new HttpError(400, 'title_required');
    }
    out.title = body.title.trim().slice(0, 500);
  } else if (!partial) {
    throw new HttpError(400, 'title_required');
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') throw new HttpError(400, 'invalid_description');
    out.description = body.description.slice(0, 10000);
  }
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) throw new HttpError(400, 'invalid_status');
    out.status = body.status;
  }
  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (!Number.isInteger(p) || p < 0 || p > 3) throw new HttpError(400, 'invalid_priority');
    out.priority = p;
  }
  if (body.position !== undefined) {
    const pos = Number(body.position);
    if (!Number.isFinite(pos)) throw new HttpError(400, 'invalid_position');
    out.position = pos;
  }
  if (body.dueAt !== undefined) {
    if (body.dueAt === null || body.dueAt === '') {
      out.due_at = null;
    } else {
      const d = new Date(body.dueAt);
      if (Number.isNaN(d.getTime())) throw new HttpError(400, 'invalid_due_at');
      out.due_at = d.toISOString();
    }
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new HttpError(400, 'invalid_tags');
    out.tags = body.tags
      .filter((t) => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
  return out;
}

function getTagsForTasks(db, ids) {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT tt.task_id AS taskId, t.name
       FROM task_tags tt
       JOIN tags t ON t.id = tt.tag_id
      WHERE tt.task_id IN (${placeholders})
      ORDER BY t.name`,
  ).all(...ids);
  const map = new Map(ids.map((id) => [id, []]));
  for (const r of rows) map.get(r.taskId).push(r.name);
  return map;
}

function setTaskTags(db, taskId, tagNames) {
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const link = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
  db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);
  for (const name of tagNames) {
    insertTag.run(name);
    const { id } = findTag.get(name);
    link.run(taskId, id);
  }
}

function nextPosition(db, status) {
  const row = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM tasks WHERE status = ?').get(status);
  return row.p;
}

export function createTaskRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const { q, status, tag } = req.query;
    const where = [];
    const params = [];
    let from = 'tasks';

    if (q && typeof q === 'string' && q.trim()) {
      from = 'tasks JOIN tasks_fts ON tasks_fts.rowid = tasks.id';
      where.push('tasks_fts MATCH ?');
      params.push(`${q.trim().replace(/"/g, '')}*`);
    }
    if (status && STATUSES.has(status)) {
      where.push('tasks.status = ?');
      params.push(status);
    }
    if (tag && typeof tag === 'string') {
      from += ' JOIN task_tags tt ON tt.task_id = tasks.id JOIN tags tg ON tg.id = tt.tag_id';
      where.push('tg.name = ?');
      params.push(tag.toLowerCase());
    }
    const sql = `
      SELECT tasks.* FROM ${from}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY tasks.status, tasks.position
    `;
    const rows = db.prepare(sql).all(...params);
    const tagMap = getTagsForTasks(db, rows.map((r) => r.id));
    res.json(rows.map((r) => rowToTask(r, tagMap.get(r.id))));
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError(404, 'task_not_found');
    const tagMap = getTagsForTasks(db, [row.id]);
    res.json(rowToTask(row, tagMap.get(row.id)));
  });

  router.post('/', (req, res) => {
    const data = validateInput(req.body || {});
    const status = data.status || 'todo';
    const position = data.position ?? nextPosition(db, status);

    const result = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO tasks (title, description, status, priority, position, due_at)
        VALUES (@title, @description, @status, @priority, @position, @due_at)
      `).run({
        title: data.title,
        description: data.description || '',
        status,
        priority: data.priority ?? 1,
        position,
        due_at: data.due_at ?? null,
      });
      const id = info.lastInsertRowid;
      if (data.tags) setTaskTags(db, id, data.tags);
      return id;
    })();

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result);
    const tagMap = getTagsForTasks(db, [row.id]);
    res.status(201).json(rowToTask(row, tagMap.get(row.id)));
  });

  router.patch('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'task_not_found');
    const data = validateInput(req.body || {}, { partial: true });

    const fields = [];
    const values = {};
    for (const key of ['title', 'description', 'status', 'priority', 'position', 'due_at']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = @${key}`);
        values[key] = data[key];
      }
    }

    db.transaction(() => {
      if (fields.length) {
        fields.push("updated_at = datetime('now')");
        db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = @id`).run({ ...values, id: existing.id });
      }
      if (data.tags !== undefined) setTaskTags(db, existing.id, data.tags);
    })();

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(existing.id);
    const tagMap = getTagsForTasks(db, [row.id]);
    res.json(rowToTask(row, tagMap.get(row.id)));
  });

  router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    if (info.changes === 0) throw new HttpError(404, 'task_not_found');
    res.status(204).end();
  });

  router.post('/reorder', (req, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items)) throw new HttpError(400, 'items_required');
    const update = db.prepare(`
      UPDATE tasks SET status = @status, position = @position, updated_at = datetime('now')
      WHERE id = @id
    `);
    db.transaction(() => {
      for (const item of items) {
        if (!item || !STATUSES.has(item.status)) throw new HttpError(400, 'invalid_item');
        update.run({ id: item.id, status: item.status, position: Number(item.position) });
      }
    })();
    res.json({ ok: true, count: items.length });
  });

  return router;
}
