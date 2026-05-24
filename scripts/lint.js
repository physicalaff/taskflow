#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'tests', 'public/js'];
const errors = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extname(entry.name) === '.js') await check(path);
  }
}

async function check(path) {
  const content = await readFile(path, 'utf8');
  const lines = content.split('\n');

  if (/\t/.test(content)) errors.push(`${path}: tab character found`);
  if (/[ \t]+$/m.test(content)) errors.push(`${path}: trailing whitespace`);
  if (!content.endsWith('\n')) errors.push(`${path}: missing trailing newline`);
  const skipConsole = path.includes('scripts/') || path.endsWith('logger.js');
  lines.forEach((line, i) => {
    if (line.length > 160) errors.push(`${path}:${i + 1}: line longer than 160 chars`);
    if (!skipConsole && /\bconsole\.log\b/.test(line)) {
      errors.push(`${path}:${i + 1}: use logger instead of console.log`);
    }
  });
}

for (const root of ROOTS) {
  await walk(root).catch(() => {});
}

if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
} else {
  console.log('Lint clean ✓');
}
