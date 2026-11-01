import path from 'path';
import os from 'os';
import { buildApp } from './app.js';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA_DIR =
  process.env['SCENESTITCH_DATA_DIR'] ?? path.join(os.homedir(), '.scenestitch', 'projects');

const HOST = process.env['HOST'] ?? '127.0.0.1';
const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

const app = buildApp({ dataDir: DATA_DIR, logger: true });
const webDir = fileURLToPath(new URL('../../web/dist/', import.meta.url));
app.get<{ Params: { '*': string } }>('/assets/*', async (req, reply) => {
  const name = req.params['*'];
  if (!/^[\w.-]+$/.test(name)) return reply.code(404).send();
  const file = path.join(webDir, 'assets', name);
  if (!(await fs.stat(file).catch(() => null))?.isFile()) return reply.code(404).send();
  return reply
    .type(
      name.endsWith('.js')
        ? 'text/javascript'
        : name.endsWith('.css')
          ? 'text/css'
          : 'application/octet-stream',
    )
    .send(createReadStream(file));
});
app.get('/', async (_req, reply) => {
  const html = await fs.readFile(path.join(webDir, 'index.html'), 'utf8').catch(() => null);
  return html
    ? reply.type('text/html').send(html)
    : reply.code(503).send({ error: 'Build the editor with pnpm build first, or use pnpm dev.' });
});

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`SceneStitch server listening at ${address}`);
});
