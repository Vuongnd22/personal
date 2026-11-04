// Embedded PostgreSQL helper (no Docker / system Postgres needed). Used by dev.mjs and backend integration tests.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import pgPkg from 'pg';

/** Starts Postgres in `dataDir` on `port`, ensures database `db` exists, returns { url, stop }. */
export async function startPostgres({ dataDir, port, db = 'archboard', persistent = true }) {
  // Force UTF8: on Windows initdb otherwise picks WIN1252 and rejects Vietnamese text.
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'postgres', port, persistent, onLog: () => {},
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  if (!fs.existsSync(`${dataDir}/PG_VERSION`)) await pg.initialise();
  await pg.start();
  const client = new pgPkg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' });
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
  if (!rowCount) await client.query(`CREATE DATABASE "${db}" ENCODING 'UTF8' TEMPLATE template0`);
  await client.end();
  return { url: `postgresql://postgres:postgres@localhost:${port}/${db}`, stop: () => pg.stop() };
}
