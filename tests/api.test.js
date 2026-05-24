import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';

let app;
let db;

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const { port } = server.address();
      try {
        const opts = { method, headers: {} };
        if (body !== undefined) {
          opts.headers['Content-Type'] = 'application/json';
          opts.body = JSON.stringify(body);
        }
        const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        server.close();
        resolve({ status: res.status, body: data });
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

describe('TaskFlow API', () => {
  before(() => {
    db = openDatabase(':memory:');
    app = createApp({ db, logger: silentLogger });
  });

  beforeEach(() => {
    db.prepare('DELETE FROM task_tags').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM tags').run();
  });

  test('GET /healthz', async () => {
    const res = await request('GET', '/healthz');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('POST /api/tasks creates a task', async () => {
    const res = await request('POST', '/api/tasks', { title: 'Test task', priority: 2 });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Test task');
    assert.equal(res.body.priority, 2);
    assert.equal(res.body.status, 'todo');
    assert.deepEqual(res.body.tags, []);
  });

  test('POST /api/tasks rejects empty title', async () => {
    const res = await request('POST', '/api/tasks', { title: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'title_required');
  });

  test('POST /api/tasks rejects invalid status', async () => {
    const res = await request('POST', '/api/tasks', { title: 'X', status: 'bogus' });
    assert.equal(res.status, 400);
  });

  test('GET /api/tasks lists tasks ordered by status and position', async () => {
    await request('POST', '/api/tasks', { title: 'A', status: 'doing' });
    await request('POST', '/api/tasks', { title: 'B', status: 'todo' });
    const res = await request('GET', '/api/tasks');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
  });

  test('PATCH /api/tasks/:id updates fields', async () => {
    const { body: created } = await request('POST', '/api/tasks', { title: 'Old' });
    const res = await request('PATCH', `/api/tasks/${created.id}`, { title: 'New', priority: 3 });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'New');
    assert.equal(res.body.priority, 3);
  });

  test('DELETE /api/tasks/:id removes task', async () => {
    const { body: created } = await request('POST', '/api/tasks', { title: 'Bye' });
    const del = await request('DELETE', `/api/tasks/${created.id}`);
    assert.equal(del.status, 204);
    const after = await request('GET', `/api/tasks/${created.id}`);
    assert.equal(after.status, 404);
  });

  test('tags are persisted and listed', async () => {
    await request('POST', '/api/tasks', { title: 'Tagged', tags: ['urgent', 'backend'] });
    const list = await request('GET', '/api/tasks');
    assert.deepEqual(list.body[0].tags.sort(), ['backend', 'urgent']);
    const tags = await request('GET', '/api/tags');
    assert.equal(tags.body.length, 2);
  });

  test('full-text search', async () => {
    await request('POST', '/api/tasks', { title: 'Write tests for API', description: 'cover edge cases' });
    await request('POST', '/api/tasks', { title: 'Deploy to prod' });
    const hit = await request('GET', '/api/tasks?q=test');
    assert.equal(hit.body.length, 1);
    assert.match(hit.body[0].title, /test/i);
  });

  test('filter by tag', async () => {
    await request('POST', '/api/tasks', { title: 'A', tags: ['x'] });
    await request('POST', '/api/tasks', { title: 'B', tags: ['y'] });
    const res = await request('GET', '/api/tasks?tag=x');
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].title, 'A');
  });

  test('reorder updates status and position', async () => {
    const { body: a } = await request('POST', '/api/tasks', { title: 'A' });
    const { body: b } = await request('POST', '/api/tasks', { title: 'B' });
    const reorder = await request('POST', '/api/tasks/reorder', {
      items: [
        { id: b.id, status: 'doing', position: 0 },
        { id: a.id, status: 'todo', position: 0 },
      ],
    });
    assert.equal(reorder.status, 200);
    const list = await request('GET', '/api/tasks');
    const moved = list.body.find((t) => t.id === b.id);
    assert.equal(moved.status, 'doing');
  });

  test('export then import round-trip', async () => {
    await request('POST', '/api/tasks', { title: 'Roundtrip', tags: ['t1'] });
    const exp = await request('GET', '/api/export');
    assert.equal(exp.body.tasks.length, 1);
    db.prepare('DELETE FROM tasks').run();
    const imp = await request('POST', '/api/import', { tasks: exp.body.tasks });
    assert.equal(imp.body.imported, 1);
    const list = await request('GET', '/api/tasks');
    assert.equal(list.body.length, 1);
    assert.deepEqual(list.body[0].tags, ['t1']);
  });
});

describe('Auth middleware', () => {
  test('requires bearer token when configured', async () => {
    const authDb = openDatabase(':memory:');
    const authApp = createApp({ db: authDb, logger: silentLogger, authToken: 'secret' });
    const server = authApp.listen(0);
    const { port } = server.address();
    const unauth = await fetch(`http://127.0.0.1:${port}/api/tasks`);
    assert.equal(unauth.status, 401);
    const ok = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
      headers: { Authorization: 'Bearer secret' },
    });
    assert.equal(ok.status, 200);
    server.close();
    authDb.close();
  });
});
