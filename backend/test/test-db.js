// Boots a throwaway embedded PostgreSQL on a free port, applies migrations, sets DATABASE_URL; resolves to a stop() fn.
const { execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const freePort = () =>
  new Promise((resolve) => {
    const srv = net.createServer().listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

module.exports = async () => {
  const { startPostgres } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'scripts', 'pg.mjs')).href);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archboard-int-'));
  const db = await startPostgres({ dataDir, port: await freePort(), db: 'archboard_test', persistent: false });
  process.env.DATABASE_URL = db.url;
  process.env.JWT_SECRET = 'integration-test-secret';
  process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
  execSync('npx prisma migrate deploy', { cwd: path.join(__dirname, '..'), env: process.env, stdio: 'ignore' });
  return () => db.stop();
};
