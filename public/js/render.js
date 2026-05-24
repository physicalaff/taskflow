const COLUMNS = [
  { key: 'todo',  title: 'To do' },
  { key: 'doing', title: 'Doing' },
  { key: 'done',  title: 'Done'  },
];

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dueClass(dueAt) {
  if (!dueAt) return null;
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  if (due < now) return 'overdue';
  if (due - now < 24 * 60 * 60 * 1000 * 2) return 'soon';
  return null;
}

function formatDue(dueAt) {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function cardHtml(task) {
  const tags = task.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const cls = dueClass(task.dueAt);
  const due = task.dueAt ? `<span class="due ${cls || ''}">${formatDue(task.dueAt)}</span>` : '';
  const priorityDot = task.priority > 0
    ? `<span class="priority-dot priority-${task.priority}" title="Priority ${task.priority}"></span>`
    : '';
  return `
    <div class="card" draggable="true" data-id="${task.id}" data-status="${task.status}">
      <div class="card-title">${escapeHtml(task.title)}</div>
      <div class="card-meta">
        ${priorityDot}
        ${due}
        ${tags}
      </div>
    </div>
  `;
}

export function renderBoard(root, tasks) {
  const grouped = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
  for (const task of tasks) {
    if (grouped[task.status]) grouped[task.status].push(task);
  }
  root.innerHTML = COLUMNS.map((col) => `
    <section class="column" data-status="${col.key}">
      <header class="column-header">
        <span>${col.title}</span>
        <span class="column-count">${grouped[col.key].length}</span>
      </header>
      <div class="cards" data-status="${col.key}">
        ${grouped[col.key].map(cardHtml).join('')}
      </div>
    </section>
  `).join('');
}

export function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), duration);
}
