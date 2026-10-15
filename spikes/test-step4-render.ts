import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { parseTimelineTable, type Project } from '../packages/core/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');
const SAMPLES_DIR = path.join(ROOT, 'samples');

const CAPYBARA_TIMELINE = `
| Time | Scene | Story beat |
|---|---|---|
| 0.0–2.2 s | 1 | Hook |
| 2.2–4.5 s | 2 | Muddy |
| 4.5–7.3 s | 3 | Warm rinse |
| 7.3–10.1 s | 4 | Foam bath |
| 10.1–13.0 s | 5 | Brush |
| 13.0–16.1 s | 6 | Rinse reveal |
| 16.1–19.3 s | 7 | Blow dry |
| 19.3–22.3 s | 8 | Styling |
| 22.3–27.2 s | 9 | Glamour reveal |
| 27.2–30.0 s | 10 | Before/after CTA |
`;

async function runStep4Render() {
  console.log('=== Step 4: Silent Reference Project Render Verification ===');

  const { scenes } = parseTimelineTable(CAPYBARA_TIMELINE);

  // Map 10 scenes to sample assets with alternating fit and crop modes
  const sampleAssets = [
    { id: 'v1', type: 'video' as const, path: 'clip01.mp4', duration: 3.0 },
    { id: 'v2', type: 'video' as const, path: 'clip02.mp4', duration: 4.0 },
    { id: 'v3', type: 'video' as const, path: 'clip03.mp4', duration: 5.0 },
    { id: 'img1', type: 'image' as const, path: 'image01.png' },
    { id: 'img2', type: 'image' as const, path: 'image02.jpg' },
  ];

  const project: Project = {
    schemaVersion: 1,
    name: 'Capybara Silent Reference Project',
    settings: { width: 1080, height: 1920, fps: 30, defaultFit: 'trim' },
    assets: sampleAssets,
    scenes: scenes.map((s, idx) => ({
      ...s,
      visual: {
        assetId: sampleAssets[idx % sampleAssets.length]!.id,
        fit: idx % 2 === 0 ? 'trim' : 'speed',
        crop: idx % 3 === 0 ? 'contain' : 'cover',
        motion: idx % 2 === 1 ? { zoomFrom: 1.0, zoomTo: 1.1 } : undefined,
      },
    })),
  };

  console.log('Bundling Remotion entry point...');
  const bundled = await bundle({
    entryPoint: path.join(ROOT, 'spikes', 'remotion-entry.tsx'),
    publicDir: SAMPLES_DIR,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          '.js': ['.tsx', '.ts', '.js'],
        },
      },
    }),
  });

  console.log('Selecting MainComposition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'SceneStitchMain',
    inputProps: { project },
  });

  console.log(
    `Composition dynamic duration: ${composition.durationInFrames} frames (${composition.durationInFrames / composition.fps}s)`,
  );

  const outPath = path.join(OUTPUT_DIR, 'step4-silent-ref.mp4');
  console.log(`Rendering silent video to ${outPath}...`);

  await renderMedia({
    composition,
    serveUrl: bundled,
    publicDir: SAMPLES_DIR,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: { project },
    concurrency: 2,
  });

  console.log('Render complete! Probing with ffprobe...');

  const rawProbe = execFileSync('ffprobe', [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_streams',
    '-show_format',
    outPath,
  ]).toString();

  const probe = JSON.parse(rawProbe) as {
    streams: Array<{
      codec_type: string;
      duration?: string;
      nb_frames: string;
      width: number;
      height: number;
    }>;
    format: { duration?: string };
  };
  const stream = probe.streams.find((s) => s.codec_type === 'video')!;

  const duration = parseFloat(stream.duration ?? probe.format.duration);
  const frames = parseInt(stream.nb_frames, 10);
  const width = stream.width;
  const height = stream.height;

  console.log(`Probe results:`);
  console.log(`  Duration: ${duration.toFixed(3)}s (Expected: 30.000s)`);
  console.log(`  Frame count: ${frames} frames (Expected: 900)`);
  console.log(`  Dimensions: ${width}x${height} (Expected: 1080x1920)`);

  if (Math.abs(duration - 30.0) < 0.05 && frames === 900 && width === 1080 && height === 1920) {
    console.log('✅ STEP 4 DONE WHEN CHECK PASSED: Silent reference project rendered perfectly!');
  } else {
    console.error('❌ STEP 4 DONE WHEN CHECK FAILED');
    process.exit(1);
  }
}

runStep4Render().catch((err) => {
  console.error('Render error:', err);
  process.exit(1);
});
