import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';

export function createPortabilityRouter(db) {
  const router = Router();

  router.get('/export', (_req, res) => {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY id').all();
    const tags = db.prepare(`
      SELECT tt.task_id AS taskId, t.name FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
    `).all();
    const tagMap = new Map();
    for (const row of tags) {
      if (!tagMap.has(row.taskId)) tagMap.set(row.taskId, []);
      tagMap.get(row.taskId).push(row.name);
    }
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: tasks.map((t) => ({ ...t, tags: tagMap.get(t.id) || [] })),
    });
  });

  router.post('/import', (req, res) => {
    const { tasks, replace } = req.body || {};
    if (!Array.isArray(tasks)) throw new HttpError(400, 'tasks_required');

    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
    const link = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
    const insertTask = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, position, due_at, created_at, updated_at)
      VALUES (@title, @description, @status, @priority, @position, @due_at, @created_at, @updated_at)
    `);

    const imported = db.transaction(() => {
      if (replace) {
        db.prepare('DELETE FROM task_tags').run();
        db.prepare('DELETE FROM tasks').run();
      }
      let count = 0;
      for (const t of tasks) {
        if (!t || typeof t.title !== 'string') continue;
        const info = insertTask.run({
          title: t.title,
          description: t.description || '',
          status: ['todo', 'doing', 'done'].includes(t.status) ? t.status : 'todo',
          priority: Number.isInteger(t.priority) ? t.priority : 1,
          position: Number.isFinite(t.position) ? t.position : count,
          due_at: t.due_at || t.dueAt || null,
          created_at: t.created_at || t.createdAt || new Date().toISOString(),
          updated_at: t.updated_at || t.updatedAt || new Date().toISOString(),
        });
        const id = info.lastInsertRowid;
        if (Array.isArray(t.tags)) {
          for (const tag of t.tags) {
            if (typeof tag !== 'string') continue;
            const name = tag.trim().toLowerCase();
            if (!name) continue;
            insertTag.run(name);
            const { id: tagId } = findTag.get(name);
            link.run(id, tagId);
          }
        }
        count++;
      }
      return count;
    })();

    res.json({ ok: true, imported });
  });

  return router;
}
