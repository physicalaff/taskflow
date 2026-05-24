const BASE = '/api';

async function request(method, path, body) {
  const opts = { method, headers: {} };
  const token = localStorage.getItem('taskflow.token');
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `http_${res.status}`);
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

export const api = {
  listTasks: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
    return request('GET', '/tasks' + (qs ? '?' + qs : ''));
  },
  createTask: (data) => request('POST', '/tasks', data),
  updateTask: (id, data) => request('PATCH', `/tasks/${id}`, data),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),
  reorder: (items) => request('POST', '/tasks/reorder', { items }),
  tags: () => request('GET', '/tags'),
  exportAll: () => request('GET', '/export'),
  importAll: (data) => request('POST', '/import', data),
};
