import { Router } from 'express';

export function createTagRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare(`
      SELECT t.name, COUNT(tt.task_id) AS count
        FROM tags t
        LEFT JOIN task_tags tt ON tt.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC, t.name
    `).all();
    res.json(rows);
  });

  return router;
}
