import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath } from 'node:url';
import { renderProject } from '../packages/server/dist/services/render.js';
import { ProjectSchema } from '../packages/core/dist/index.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'output', 'smoke-project');
await fs.mkdir(directory, { recursive: true });
await fs.cp(path.join(root, 'samples'), path.join(directory, 'media'), { recursive: true });
const project = ProjectSchema.parse({
  name: 'Smoke export',
  settings: { width: 360, height: 640, fps: 30 },
  assets: [
    { id: 'image', type: 'image', path: 'media/image01.png' },
    { id: 'video', type: 'video', path: 'media/clip01.mp4', duration: 3 },
    { id: 'vo', type: 'audio', path: 'media/voiceover01.mp3', duration: 2.5, license: 'CC0' },
    { id: 'music', type: 'audio', path: 'media/music01.mp3', duration: 30, license: 'CC0' },
  ],
  scenes: [
    {
      id: 1,
      label: 'Image',
      start: 0,
      end: 3,
      visual: { assetId: 'image', motion: { zoomFrom: 1, zoomTo: 1.05 } },
      caption: { text: 'SceneStitch 👋', offset: 0.1 },
      voiceover: { assetId: 'vo', offset: 0.1 },
    },
    {
      id: 2,
      label: 'Video',
      start: 3,
      end: 6,
      visual: { assetId: 'video', fit: 'loop', crop: 'contain' },
      transitionIn: { type: 'crossfade', duration: 0.2 },
      sfx: [{ assetId: 'vo', offset: -0.2, gainDb: -9, fadeOut: 0.1 }],
    },
    {
      id: 3,
      label: 'Split',
      start: 6,
      end: 8,
      template: { type: 'split-screen', left: { fromScene: 1 }, right: { fromScene: 2 } },
      transitionIn: { type: 'flash', duration: 0.2 },
    },
  ],
  music: { assetId: 'music', overrides: [{ start: 4, end: 5, gainDb: -3 }] },
});
await fs.writeFile(path.join(directory, 'project.json'), JSON.stringify(project, null, 2));
const start = Date.now();
const result = await renderProject(project, directory, path.join(directory, 'smoke.mp4'), {
  onProgress: (p, message) => console.log(Math.round(p * 100), message),
});
console.log(JSON.stringify({ ...result, elapsedSeconds: (Date.now() - start) / 1000 }, null, 2));
process.exitCode = 0;
