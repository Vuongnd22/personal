// One-command dev stack: embedded Postgres (unless DATABASE_URL is set) + migrate + seed-if-empty + backend + frontend.
//   npm run dev            start everything (Ctrl+C stops all)
//   npm run db:reset       drop, migrate and re-seed the dev database, then exit
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPostgres } from './pg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resetOnly = process.argv.includes('--reset-only');
const isWin = process.platform === 'win32';

let db = null;
let url = process.env.DATABASE_URL;
if (!url) {
  console.log('▸ starting embedded PostgreSQL on :5433 (data in .pgdata/)');
  db = await startPostgres({ dataDir: path.join(root, '.pgdata'), port: 5433 });
  url = db.url;
}
const env = { ...process.env, DATABASE_URL: url, APP_TIMEZONE: process.env.APP_TIMEZONE ?? 'Asia/Ho_Chi_Minh' };

const run = (args, opts = {}) => {
  const r = spawnSync('npx', args, { cwd: path.join(root, 'backend'), env, stdio: 'inherit', shell: isWin, ...opts });
  if (r.status !== 0) throw new Error(`npx ${args.join(' ')} failed`);
};

try {
  if (resetOnly) {
    run(['prisma', 'migrate', 'reset', '--force', '--skip-seed']);
    run(['ts-node', '--transpile-only', 'prisma/seed.ts']);
    console.log('✔ database reset and seeded');
  } else {
    run(['prisma', 'migrate', 'deploy']);
    run(['ts-node', '--transpile-only', 'prisma/seed.ts', '--if-empty']);
  }
} catch (e) {
  console.error(e.message);
  await db?.stop();
  process.exit(1);
}
if (resetOnly) {
  await db?.stop();
  process.exit(0);
}

const children = [];
const start = (name, args, extraEnv = {}) => {
  const child = spawn('npm', args, { cwd: root, env: { ...env, ...extraEnv }, stdio: 'inherit', shell: isWin });
  child.on('exit', (code) => code && console.log(`✖ ${name} exited with code ${code}`));
  children.push(child);
};
start('backend', ['run', 'dev', '--workspace', 'backend'], { PORT: '4000' });
if (fs.existsSync(path.join(root, 'frontend', 'package.json'))) {
  start('frontend', ['run', 'dev', '--workspace', 'frontend'], { BACKEND_URL: 'http://localhost:4000' });
}
console.log('▸ frontend http://localhost:3000  ·  api http://localhost:4000/api  ·  login admin@archboard.local / Admin@123');

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (isWin) spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill('SIGTERM');
  }
  await db?.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
