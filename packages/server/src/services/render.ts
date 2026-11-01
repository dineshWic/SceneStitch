import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition, makeCancelSignal, openBrowser } from '@remotion/renderer';
import {
  buildFrameTimeline,
  validateTimeline,
  projectWarnings,
  captionsSrt,
  creditsText,
  type Project,
} from '@scenestitch/core';
import { probeFile } from './ffprobe.js';
import { serveRenderAssets } from './render-assets.js';
import { renderProfile, withAbort } from './render-profile.js';
import { draftProxies } from './draft-proxies.js';
const exec = promisify(execFile);
let compositionBundle: Promise<string> | undefined;
export interface RenderJob {
  id: string;
  projectId: string;
  draft: boolean;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  progress: number;
  logs: string[];
  output?: string;
  verification?: Record<string, unknown>;
}
export async function renderProject(
  project: Project,
  directory: string,
  output: string,
  options: {
    draft?: boolean;
    onProgress?: (progress: number, message: string) => void;
    signal?: AbortSignal;
  } = {},
): Promise<Record<string, unknown>> {
  const started = performance.now();
  const timings: Record<string, number> = {};
  let phase = 'bundle';
  let phaseStarted = started;
  const mark = (next: string) => {
    const now = performance.now();
    timings[phase] = (timings[phase] ?? 0) + (now - phaseStarted) / 1000;
    phase = next;
    phaseStarted = now;
  };
  const profile = renderProfile(
    project.settings,
    options.draft ?? false,
    process.env['SCENESTITCH_RENDER_CONCURRENCY'],
  );
  const errors = validateTimeline(project.scenes);
  if (!project.scenes.length || errors.length)
    throw new Error(errors.map((e) => e.message).join('\n') || 'Add scenes before exporting');
  const { totalFrames } = buildFrameTimeline(project.scenes, project.settings.fps);
  if (totalFrames < 1) throw new Error('Project must contain at least one frame');
  const warnings = projectWarnings(project);
  if (
    warnings.some((w) =>
      /missing visual|Missing scene|Circular|missing voiceover|missing SFX|Missing music|Duplicate scene|shorter than one frame/i.test(
        w,
      ),
    )
  )
    throw new Error(warnings.join('\n'));
  const temporary = `${output}.partial.mp4`;
  const normalized = `${output}.normalized.mp4`;
  let completed = false;
  let media: Awaited<ReturnType<typeof serveRenderAssets>> | undefined;
  let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
  const cancel = makeCancelSignal();
  const abort = () => {
    cancel.cancel();
    void browser?.close({ silent: true }).catch(() => {});
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  const check = () => {
    if (options.signal?.aborted) throw new Error('Render cancelled');
  };
  try {
    check();
    options.onProgress?.(0.01, 'Bundling composition');
    const entryPoint = fileURLToPath(
      new URL('../../../composition/src/entry.tsx', import.meta.url),
    );
    compositionBundle ??= bundle({
      entryPoint,
      publicDir: null,
      webpackOverride: (config) => ({
        ...config,
        resolve: { ...config.resolve, extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
      }),
    }).catch((error: unknown) => {
      compositionBundle = undefined;
      throw error;
    });
    const serveUrl = await withAbort(compositionBundle, options.signal);
    mark('proxies');
    check();
    if (options.draft) options.onProgress?.(0.02, 'Preparing draft media');
    const mediaProject = options.draft
      ? await draftProxies(project, directory, profile.scale, options.signal)
      : project;
    mark('browser');
    media = await serveRenderAssets(mediaProject, directory);
    const inputProps = { project: media.project };
    const browserExecutable = process.env['SCENESTITCH_BROWSER_EXECUTABLE'];
    browser = await openBrowser('chrome', { browserExecutable });
    check();
    mark('metadata');
    const composition = await selectComposition({
      puppeteerInstance: browser,
      serveUrl,
      id: 'SceneStitchMain',
      inputProps,
      browserExecutable,
    });
    // Render at scale: project coordinate space stays identical in preview and export.
    const { scale } = profile;
    mark('frames');
    await fs.mkdir(path.dirname(output), { recursive: true });
    await renderMedia({
      puppeteerInstance: browser,
      browserExecutable,
      composition,
      serveUrl,
      inputProps,
      codec: 'h264',
      audioCodec: 'aac',
      outputLocation: temporary,
      scale,
      crf: profile.crf,
      x264Preset: profile.x264Preset,
      concurrency: profile.concurrency,
      cancelSignal: cancel.cancelSignal,
      onProgress: ({ progress }) =>
        options.onProgress?.(0.05 + progress * 0.75, 'Rendering frames'),
    });
    check();
    mark('audio');
    const probe = await probeFile(temporary);
    let finalSource = temporary;
    let loudness: number | undefined;
    let truePeak: number | undefined;
    if (probe.hasAudio) {
      options.onProgress?.(0.82, 'Measuring audio loudness');
      const target = project.export?.loudnessLufs ?? -14;
      const measured = await exec(
        'ffmpeg',
        [
          '-hide_banner',
          '-i',
          temporary,
          '-af',
          `loudnorm=I=${target}:TP=-1:LRA=11:print_format=json`,
          '-f',
          'null',
          '-',
        ],
        { signal: options.signal, maxBuffer: 16 * 1024 * 1024 },
      );
      const match = measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
      if (!match) throw new Error('FFmpeg did not return loudness measurements');
      const stats = JSON.parse(match[0]) as Record<string, string>;
      if (Number.isFinite(Number(stats['input_i']))) {
        options.onProgress?.(0.9, 'Normalizing audio');
        const filter = `loudnorm=I=${target}:TP=-1:LRA=11:measured_I=${stats['input_i']}:measured_TP=${stats['input_tp']}:measured_LRA=${stats['input_lra']}:measured_thresh=${stats['input_thresh']}:offset=${stats['target_offset']}:linear=true`;
        await exec(
          'ffmpeg',
          [
            '-y',
            '-i',
            temporary,
            '-c:v',
            'copy',
            '-af',
            filter,
            '-ar',
            '48000',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            normalized,
          ],
          { signal: options.signal, maxBuffer: 16 * 1024 * 1024 },
        );
        finalSource = normalized;
        const verification = await exec(
          'ffmpeg',
          [
            '-hide_banner',
            '-i',
            normalized,
            '-af',
            `loudnorm=I=${target}:TP=-1:LRA=11:print_format=json`,
            '-f',
            'null',
            '-',
          ],
          { signal: options.signal, maxBuffer: 16 * 1024 * 1024 },
        );
        const result = verification.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
        if (result) {
          const measured = JSON.parse(result[0]) as Record<string, string>;
          loudness = Number(measured['input_i']);
          truePeak = Number(measured['input_tp']);
        }
        if (loudness !== undefined && Math.abs(loudness - target) > 1)
          throw new Error(`Audio loudness ${loudness} LUFS is outside target tolerance`);
        if (truePeak !== undefined && truePeak > -1)
          throw new Error(`Audio true peak ${truePeak} dBTP exceeds -1 dBTP`);
      }
    }
    check();
    mark('verification');
    const final = await probeFile(finalSource);
    if (
      Math.abs(final.duration - totalFrames / project.settings.fps) >
        1 / project.settings.fps + 0.005 ||
      final.codec !== 'h264' ||
      (final.hasAudio && final.audioCodec !== 'aac') ||
      Math.abs(final.fps - project.settings.fps) > 0.02 ||
      final.width !== Math.round(project.settings.width * scale) ||
      final.height !== Math.round(project.settings.height * scale)
    )
      throw new Error('Export verification failed: duration, codec, fps or dimensions mismatch');
    await fs.writeFile(`${output}.srt`, captionsSrt(project));
    await fs.writeFile(`${output}.credits.txt`, creditsText(project));
    if (final.hasAudio)
      await exec('ffmpeg', ['-y', '-i', finalSource, '-vn', '-c:a', 'pcm_s16le', `${output}.wav`], {
        signal: options.signal,
        maxBuffer: 16 * 1024 * 1024,
      });
    check();
    await fs.rename(finalSource, output);
    completed = true;
    mark('complete');
    timings['total'] = (performance.now() - started) / 1000;
    options.onProgress?.(1, 'Export verified');
    return {
      ...final,
      totalFrames,
      loudnessLufs: loudness,
      truePeakDbtp: truePeak,
      warnings,
      timings,
      renderProfile: profile,
    };
  } finally {
    await browser?.close({ silent: true }).catch(() => {});
    await media?.close();
    options.signal?.removeEventListener('abort', abort);
    await fs.rm(temporary, { force: true });
    await fs.rm(normalized, { force: true });
    if (!completed)
      for (const suffix of ['.srt', '.credits.txt', '.wav'])
        await fs.rm(`${output}${suffix}`, { force: true });
  }
}
