import { spawn } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = [
  spawn(pnpm, ['--filter', '@scenestitch/server', 'start'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  }),
  spawn(pnpm, ['--filter', '@scenestitch/web', 'dev'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  }),
];
for (const child of children)
  child.on('error', (error) => {
    console.error(error.message);
    stop();
    process.exitCode = 1;
  });
function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('SceneStitch editor: http://127.0.0.1:5173');
