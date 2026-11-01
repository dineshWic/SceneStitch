import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { renderProject } from '../packages/server/dist/services/render.js';
import { probeFile } from '../packages/server/dist/services/ffprobe.js';
import { ProjectSchema } from '../packages/core/dist/index.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'output', 'reference-benchmark');
await fs.mkdir(path.join(directory, 'media'), { recursive: true });
for (const file of [
  'clip01.mp4',
  'clip02.mp4',
  'clip03.mp4',
  'image01.png',
  'image02.jpg',
  'music01.mp3',
])
  await fs.copyFile(path.join(root, 'samples', file), path.join(directory, 'media', file));
await promisify(execFile)('ffmpeg', [
  '-v',
  'error',
  '-y',
  '-i',
  path.join(root, 'samples/voiceover01.mp3'),
  '-t',
  '0.8',
  path.join(directory, 'media/narration.wav'),
]);
const assets = [];
for (const [id, file, type] of [
  ['a', 'clip01.mp4', 'video'],
  ['b', 'clip02.mp4', 'video'],
  ['c', 'clip03.mp4', 'video'],
  ['before', 'image01.png', 'image'],
  ['after', 'image02.jpg', 'image'],
  ['vo', 'narration.wav', 'audio'],
  ['music', 'music01.mp3', 'audio'],
]) {
  const probe = await probeFile(path.join(directory, 'media', file));
  assets.push({
    id,
    name: file,
    path: `media/${file}`,
    type,
    ...(type === 'image' ? {} : { duration: probe.duration }),
    license: 'CC0',
  });
}
const ends = [2.2, 4.5, 7.3, 10.1, 13, 16.1, 19.3, 22.3, 27.2, 30];
const labels = [
  'Hook',
  'Muddy',
  'Warm rinse',
  'Foam bath',
  'Brush',
  'Rinse reveal',
  'Blow dry',
  'Styling',
  'Glamour reveal',
  'Before/after',
];
const project = ProjectSchema.parse({
  name: 'Synthetic reference benchmark',
  settings: { width: 1080, height: 1920, fps: 30 },
  assets,
  scenes: ends.map((end, i) => ({
    id: i + 1,
    label: labels[i],
    start: ends[i - 1] ?? 0,
    end,
    visual: {
      assetId: ['before', 'a', 'b', 'a', 'b', 'c', 'b', 'a', 'after', 'after'][i],
      fit: 'loop',
      motion: { zoomFrom: 1, zoomTo: 1.03 },
    },
    caption: { text: `${labels[i]} 🐾`, offset: 0.1 },
    ...(i < 9 ? { voiceover: { assetId: 'vo', offset: 0.1 } } : {}),
    ...(i === 2 ? { sfx: [{ assetId: 'vo', offset: -0.2, gainDb: -12 }] } : {}),
    ...(i === 8 ? { transitionIn: { type: 'flash', duration: 0.2 } } : {}),
    ...(i === 9
      ? { template: { type: 'split-screen', left: { fromScene: 1 }, right: { fromScene: 9 } } }
      : {}),
  })),
  music: { assetId: 'music', fadeIn: 0.5, overrides: [{ start: 10.1, end: 13, gainDb: -3 }] },
});
await fs.writeFile(path.join(directory, 'project.json'), JSON.stringify(project, null, 2));
const draft = !process.argv.includes('--final');
const requested = process.argv.indexOf('--runs');
const runs = requested < 0 ? 1 : Number(process.argv[requested + 1]);
if (!Number.isInteger(runs) || runs < 1 || runs > 3)
  throw new Error('--runs must be between 1 and 3');
const results = [];
for (let i = 0; i < runs; i++) {
  let last = '';
  const result = await renderProject(
    project,
    directory,
    path.join(directory, `${draft ? 'draft' : 'final'}-${i + 1}.mp4`),
    {
      draft,
      onProgress: (progress, message) => {
        if (message !== last) {
          console.log(`${Math.round(progress * 100)}% ${message}`);
          last = message;
        }
      },
    },
  );
  results.push({ run: i + 1, draft, ...result });
  await fs.writeFile(
    path.join(directory, `${draft ? 'draft' : 'final'}-results.json`),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results.at(-1), null, 2));
}
