import { api } from './api.js';
import { renderBoard, showToast } from './render.js';

const state = {
  tasks: [],
  query: '',
  editingId: null,
};

const $ = (sel) => document.querySelector(sel);
const board = $('#board');
const searchInput = $('#search');
const dialog = $('#task-dialog');
const form = $('#task-form');
const shortcutsDialog = $('#shortcuts-dialog');

async function reload() {
  try {
    state.tasks = await api.listTasks({ q: state.query });
    renderBoard(board, state.tasks);
    bindCardEvents();
  } catch (err) {
    showToast(`Failed to load: ${err.message}`);
  }
}

function openTaskDialog(task = null) {
  state.editingId = task?.id ?? null;
  $('#dialog-title').textContent = task ? 'Edit task' : 'New task';
  $('#delete-btn').classList.toggle('hidden', !task);
  form.reset();
  if (task) {
    form.title.value = task.title;
    form.description.value = task.description || '';
    form.status.value = task.status;
    form.priority.value = String(task.priority);
    form.dueAt.value = task.dueAt ? task.dueAt.slice(0, 10) : '';
    form.tags.value = (task.tags || []).join(', ');
  }
  dialog.showModal();
  setTimeout(() => form.title.focus(), 50);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    title: form.title.value.trim(),
    description: form.description.value,
    status: form.status.value,
    priority: Number(form.priority.value),
    dueAt: form.dueAt.value || null,
    tags: form.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
  };
  if (!data.title) return;
  try {
    if (state.editingId) {
      await api.updateTask(state.editingId, data);
      showToast('Saved');
    } else {
      await api.createTask(data);
      showToast('Created');
    }
    dialog.close();
    await reload();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
});

$('#cancel-btn').addEventListener('click', () => dialog.close());

$('#delete-btn').addEventListener('click', async () => {
  if (!state.editingId) return;
  if (!confirm('Delete this task?')) return;
  try {
    await api.deleteTask(state.editingId);
    dialog.close();
    showToast('Deleted');
    await reload();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
});

$('#new-task-btn').addEventListener('click', () => openTaskDialog());

function bindCardEvents() {
  board.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.id);
      const task = state.tasks.find((t) => t.id === id);
      if (task) openTaskDialog(task);
    });
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  board.querySelectorAll('.cards').forEach((zone) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drop-target');
      const dragging = board.querySelector('.dragging');
      if (!dragging) return;
      const after = getDragAfterElement(zone, e.clientY);
      if (after == null) zone.appendChild(dragging);
      else zone.insertBefore(dragging, after);
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drop-target'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drop-target');
      await persistOrder();
    });
  });
}

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.card:not(.dragging)')];
  return cards.reduce((closest, card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: card };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}

async function persistOrder() {
  const items = [];
  board.querySelectorAll('.column').forEach((col) => {
    const status = col.dataset.status;
    col.querySelectorAll('.card').forEach((card, idx) => {
      items.push({ id: Number(card.dataset.id), status, position: idx });
    });
  });
  try {
    await api.reorder(items);
    await reload();
  } catch (err) {
    showToast(`Reorder failed: ${err.message}`);
    await reload();
  }
}

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = searchInput.value.trim();
    reload();
  }, 200);
});

const themeBtn = $('#theme-toggle');
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem('taskflow.theme', theme);
}
themeBtn.addEventListener('click', () => {
  const current = document.body.dataset.theme;
  const next = current === 'dark' ? 'light' : (current === 'light' ? 'auto' : 'dark');
  applyTheme(next);
  showToast(`Theme: ${next}`);
});
applyTheme(localStorage.getItem('taskflow.theme') || 'auto');

const menu = $('#menu');
$('#menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  menu.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (!menu.contains(e.target) && e.target !== $('#menu-btn')) menu.classList.add('hidden');
});

menu.addEventListener('click', async (e) => {
  const action = e.target.dataset?.action;
  if (!action) return;
  menu.classList.add('hidden');
  if (action === 'export') {
    const data = await api.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } else if (action === 'import') {
    $('#import-file').click();
  } else if (action === 'shortcuts') {
    shortcutsDialog.showModal();
  }
});

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.tasks)) throw new Error('Invalid file');
    if (!confirm(`Import ${data.tasks.length} tasks? This will append to existing tasks.`)) return;
    const result = await api.importAll({ tasks: data.tasks, replace: false });
    showToast(`Imported ${result.imported} tasks`);
    await reload();
  } catch (err) {
    showToast(`Import failed: ${err.message}`);
  } finally {
    e.target.value = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (dialog.open || shortcutsDialog.open) return;
  if (e.key === 'n')  { e.preventDefault(); openTaskDialog(); }
  if (e.key === '/')  { e.preventDefault(); searchInput.focus(); }
  if (e.key === 't')  { themeBtn.click(); }
  if (e.key === '?')  { shortcutsDialog.showModal(); }
});

reload();
