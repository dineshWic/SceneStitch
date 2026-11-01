import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath } from 'node:url';
import { renderProject } from '../packages/server/dist/services/render.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'output/reference-benchmark');
const project = JSON.parse(await fs.readFile(path.join(directory, 'project.json'), 'utf8'));
const output = path.join(directory, 'cancel-smoke.mp4');
const controller = new globalThis.AbortController();
let interrupted = false;
try {
  await renderProject(project, directory, output, {
    draft: true,
    signal: controller.signal,
    onProgress: (progress, message) => {
      if (message === 'Rendering frames' && progress > 0.06) controller.abort();
    },
  });
} catch (error) {
  if (!controller.signal.aborted) throw error;
  interrupted = true;
}
if (!interrupted) throw new Error('Render unexpectedly completed without exercising cancellation');
for (const suffix of ['', '.partial.mp4', '.normalized.mp4', '.srt', '.credits.txt', '.wav']) {
  if (await fs.stat(`${output}${suffix}`).catch(() => null))
    throw new Error(`Cancelled export left a file: ${suffix}`);
}
console.log(
  JSON.stringify({ cancelledDuringRendering: true, incompleteFilesRemoved: true }, null, 2),
);
process.exitCode = 0;
