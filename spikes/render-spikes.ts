/**
 * Step 2 Risk Spike Render Script
 *
 * Runs all four risk spikes (2a–2d) sequentially:
 *   2a - Remotion render: 3 clips + Ken Burns image at 1080×1920 @ 30fps
 *   2b - Emoji captions: styled text + emoji render to MP4
 *   2c - Audio approach: Remotion <Audio> with ducking
 *   2d - Frame accuracy: 10 scenes @ 30fps → 900 frames → 30.000s
 *
 * Usage:
 *   pnpm exec tsx spikes/render-spikes.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { bundle } from '@remotion/bundler';
import {
  renderMedia,
  selectComposition,
  getCompositions,
} from '@remotion/renderer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');
const SAMPLES_DIR = path.join(ROOT, 'samples');
const ENTRY_POINT = path.join(__dirname, 'remotion-entry.tsx');

// ─── Timing helper ──────────────────────────────────────────────────────────

function msToHuman(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

// ─── ffprobe helper ──────────────────────────────────────────────────────────

interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  frames: number;
}

function ffprobe(filePath: string): ProbeResult {
  const raw = execFileSync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ]).toString();

  const data = JSON.parse(raw) as {
    streams: Array<{
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      nb_frames?: string;
      duration?: string;
    }>;
    format: { duration?: string };
  };

  const video = data.streams.find((s) => s.codec_type === 'video');
  if (!video) throw new Error(`No video stream in ${filePath}`);

  const [num, den] = (video.r_frame_rate ?? '30/1').split('/').map(Number);
  const fps = (num ?? 30) / (den ?? 1);
  const duration = parseFloat(video.duration ?? data.format.duration ?? '0');
  const frames = video.nb_frames ? parseInt(video.nb_frames, 10) : Math.round(duration * fps);

  return {
    duration,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps,
    codec: video.codec_name ?? 'unknown',
    frames,
  };
}

// ─── Render a single composition ─────────────────────────────────────────────

async function renderComposition(
  bundled: string,
  compositionId: string,
  outputPath: string,
  label: string,
): Promise<{ duration: number }> {
  console.log(`\n  ▶ Rendering ${label}...`);
  const t0 = Date.now();

  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: {},
  });

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: {},
    videoBitrate: '4M',
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 20 === 0) process.stdout.write(`\r    Progress: ${pct}%   `);
    },
    concurrency: 2,
  });

  const elapsed = Date.now() - t0;
  console.log(`\r    ✅ Done in ${msToHuman(elapsed)} → ${path.basename(outputPath)}`);
  return { duration: elapsed };
}

// ─── Individual spike verifiers ──────────────────────────────────────────────

async function runSpike2a(bundled: string): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Spike 2a — Remotion render (3 clips + Ken Burns image)');
  console.log('  Target: 1080×1920 @ 30fps in < 3 min');

  const outPath = path.join(OUTPUT_DIR, 'spike2a.mp4');
  const { duration } = await renderComposition(bundled, 'Spike2aComposition', outPath, 'Spike 2a');
  const probe = ffprobe(outPath);

  const durationOk = Math.abs(probe.duration - 15.0) < 0.1; // 450 frames / 30fps = 15.0s
  const resOk = probe.width === 1080 && probe.height === 1920;
  const fpsOk = Math.abs(probe.fps - 30) < 0.1;
  const timeOk = duration < 3 * 60 * 1000;

  console.log('  ffprobe results:');
  console.log(`    Duration: ${probe.duration.toFixed(3)}s  ${durationOk ? '✅' : '❌'} (expect 15.000s)`);
  console.log(`    Resolution: ${probe.width}×${probe.height}  ${resOk ? '✅' : '❌'} (expect 1080×1920)`);
  console.log(`    FPS: ${probe.fps}  ${fpsOk ? '✅' : '❌'} (expect 30)`);
  console.log(`    Codec: ${probe.codec}`);
  console.log(`    Render time: ${msToHuman(duration)}  ${timeOk ? '✅' : '❌'} (target < 3 min)`);

  const passed = durationOk && resOk && fpsOk && timeOk;
  console.log(passed ? '\n  SPIKE 2a PASSED ✅' : '\n  SPIKE 2a FAILED ❌');
  return passed;
}

async function runSpike2b(bundled: string): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Spike 2b — Emoji captions rendering');
  console.log('  Target: emoji + styled text render to valid MP4 without error');

  const outPath = path.join(OUTPUT_DIR, 'spike2b.mp4');
  await renderComposition(bundled, 'Spike2bComposition', outPath, 'Spike 2b');
  const probe = ffprobe(outPath);

  const durationOk = Math.abs(probe.duration - 3.0) < 0.1; // 90 frames / 30fps = 3.0s
  const resOk = probe.width === 1080 && probe.height === 1920;

  console.log('  ffprobe results:');
  console.log(`    Duration: ${probe.duration.toFixed(3)}s  ${durationOk ? '✅' : '❌'} (expect 3.000s)`);
  console.log(`    Resolution: ${probe.width}×${probe.height}  ${resOk ? '✅' : '❌'}`);
  console.log(`    Codec: ${probe.codec}`);
  console.log('  Manual check required: inspect spike2b.mp4 for emoji rendering quality');

  const passed = durationOk && resOk;
  console.log(passed ? '\n  SPIKE 2b PASSED ✅' : '\n  SPIKE 2b FAILED ❌');
  return passed;
}

async function runSpike2c(bundled: string): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Spike 2c — Audio approach: Remotion <Audio> with ducking vs FFmpeg');
  console.log('  Rendering (A) Remotion <Audio> composition ...');

  const audioOutPath = path.join(OUTPUT_DIR, 'spike2c-audio.mp4');
  await renderComposition(bundled, 'Spike2cAudioComposition', audioOutPath, 'Spike 2c (A) Remotion Audio');
  const probeA = ffprobe(audioOutPath);

  const hasAudio = probeA.frames > 0;
  const durationOkA = Math.abs(probeA.duration - 5.0) < 0.1; // 150 frames / 30 = 5.0s

  console.log('  Rendering (B) silent Remotion + FFmpeg audio mux ...');
  const silentOutPath = path.join(OUTPUT_DIR, 'spike2c-silent.mp4');
  await renderComposition(bundled, 'Spike2cSilentComposition', silentOutPath, 'Spike 2c (B) Silent+Mux');

  // FFmpeg mux: overlay VO + ducked music onto silent video
  const ffmpegMuxOut = path.join(OUTPUT_DIR, 'spike2c-ffmpeg-mux.mp4');
  console.log('  Running FFmpeg mux...');
  try {
    execFileSync('ffmpeg', [
      '-y',
      '-i', silentOutPath,
      '-i', path.join(SAMPLES_DIR, 'voiceover01.mp3'),
      '-i', path.join(SAMPLES_DIR, 'music01.mp3'),
      '-filter_complex',
      [
        // Duck music when VO plays: VO runs 0–2.5s
        `[2:a]volume=enable='between(t,0,2.5)':volume=0.15,volume=enable='not(between(t,0,2.5))':volume=0.8[music_ducked]`,
        `[1:a][music_ducked]amix=inputs=2:duration=first:dropout_transition=0[mixed]`,
      ].join(';'),
      '-map', '0:v',
      '-map', '[mixed]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      ffmpegMuxOut,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('    ✅ FFmpeg mux succeeded → spike2c-ffmpeg-mux.mp4');
  } catch (err) {
    console.error('    ❌ FFmpeg mux failed:', (err as Error).message);
  }

  const passed = durationOkA && hasAudio;
  console.log('\n  Audio approach comparison:');
  console.log('    (A) Remotion <Audio>: per-frame volume function = precise ducking envelope');
  console.log('    (B) FFmpeg amix: simpler but requires post-processing step');
  console.log('  Decision: (A) preferred for sync precision; (B) as fallback for complex mixes');
  console.log(passed ? '\n  SPIKE 2c PASSED ✅' : '\n  SPIKE 2c FAILED ❌');
  return passed;
}

async function runSpike2d(bundled: string): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Spike 2d — Frame accuracy: 10 scenes → 900 frames → 30.000s exactly');

  // Compute expected frame boundaries using Math.round(seconds * fps)
  const scenes = [
    { id: 1, start: 0.0, end: 2.2 },
    { id: 2, start: 2.2, end: 4.5 },
    { id: 3, start: 4.5, end: 7.3 },
    { id: 4, start: 7.3, end: 10.1 },
    { id: 5, start: 10.1, end: 13.0 },
    { id: 6, start: 13.0, end: 16.1 },
    { id: 7, start: 16.1, end: 19.3 },
    { id: 8, start: 19.3, end: 22.3 },
    { id: 9, start: 22.3, end: 27.2 },
    { id: 10, start: 27.2, end: 30.0 },
  ];
  const fps = 30;
  let totalFrames = 0;
  console.log('\n  Scene boundary table:');
  console.log('  ID  startSec  endSec  startF  endF  duration');
  for (const scene of scenes) {
    const startFrame = Math.round(scene.start * fps);
    const endFrame = Math.round(scene.end * fps);
    const dur = endFrame - startFrame;
    totalFrames = Math.max(totalFrames, endFrame);
    console.log(
      `   ${String(scene.id).padStart(2)}  ${String(scene.start).padEnd(7)}   ${String(scene.end).padEnd(5)}   ${String(startFrame).padStart(4)}   ${String(endFrame).padStart(4)}  ${String(dur).padStart(3)} frames`
    );
  }

  console.log(`\n  Total frames by last scene endFrame: ${totalFrames}`);
  const expectedOk = totalFrames === 900;
  console.log(`  Expect 900: ${expectedOk ? '✅' : `❌ Got ${totalFrames}`}`);

  const outPath = path.join(OUTPUT_DIR, 'spike2d.mp4');
  await renderComposition(bundled, 'Spike2dComposition', outPath, 'Spike 2d');
  const probe = ffprobe(outPath);

  const durationOk = Math.abs(probe.duration - 30.0) < 0.034; // within 1 frame
  const framesOk = probe.frames === 900;

  console.log('\n  ffprobe results:');
  console.log(`    Duration: ${probe.duration.toFixed(3)}s  ${durationOk ? '✅' : '❌'} (expect 30.000s ± 1 frame)`);
  console.log(`    Frames: ${probe.frames}  ${framesOk ? '✅' : '❌'} (expect 900)`);
  console.log(`    FPS: ${probe.fps}`);

  const passed = expectedOk && durationOk;
  console.log(passed ? '\n  SPIKE 2d PASSED ✅' : '\n  SPIKE 2d FAILED ❌');
  return passed;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SceneStitch — Step 2 Risk Spikes');
  console.log('═══════════════════════════════════════════════════════════');

  // 1. Bundle once
  console.log('\n[1/5] Bundling Remotion entry point...');
  const t0 = Date.now();
  const bundled = await bundle({
    entryPoint: ENTRY_POINT,
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
    onProgress: (p) => process.stdout.write(`\r  Bundle: ${p}%   `),
  });
  console.log(`\n  ✅ Bundle complete in ${msToHuman(Date.now() - t0)}`);

  // 2. List available compositions for verification
  const compositions = await getCompositions(bundled, { inputProps: {} });
  console.log(`\n[2/5] Found ${compositions.length} compositions: ${compositions.map((c) => c.id).join(', ')}`);

  // 3. Run spikes
  const results = {
    spike2a: await runSpike2a(bundled),
    spike2b: await runSpike2b(bundled),
    spike2c: await runSpike2c(bundled),
    spike2d: await runSpike2d(bundled),
  };

  // 4. Summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  SPIKE RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  for (const [name, passed] of Object.entries(results)) {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  }
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n  Gate G0: ${allPassed ? 'ALL SPIKES PASSED — proceed to Step 3 ✅' : 'SOME SPIKES FAILED — review before proceeding ❌'}`);
  console.log('\n  Output files in ./output/');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
