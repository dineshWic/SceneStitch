import path from 'path';
import os from 'os';
import { buildApp } from './app.js';

const DATA_DIR =
  process.env['SCENESTITCH_DATA_DIR'] ?? path.join(os.homedir(), '.scenestitch', 'projects');

const HOST = process.env['HOST'] ?? '127.0.0.1';
const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

const app = buildApp({ dataDir: DATA_DIR, logger: true });

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`SceneStitch server listening at ${address}`);
});
