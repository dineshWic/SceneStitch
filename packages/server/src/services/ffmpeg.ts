import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

export interface NormalizationOptions {
  targetFps?: number;
  crf?: number;
  preset?: string;
}

/**
 * Normalize a video to constant-fps H.264/AAC MP4, never touching the original.
 * Handles rotation metadata automatically (FFmpeg auto-rotates on decode).
 */
export async function normalizeVideo(
  inputPath: string,
  outputPath: string,
  options: NormalizationOptions = {},
): Promise<void> {
  const { targetFps = 30, crf = 16, preset = 'fast' } = options;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vf', `fps=${targetFps}`,
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', preset,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

/**
 * Generate a thumbnail JPEG from a video or image.
 * For video, grabs the frame at `offsetSecs` (default: 1s or midpoint if shorter).
 */
export async function generateThumbnail(
  inputPath: string,
  outputPath: string,
  durationSecs?: number,
): Promise<void> {
  const offset = durationSecs !== undefined
    ? Math.min(1, durationSecs / 2)
    : 1;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await execFileAsync('ffmpeg', [
    '-y',
    '-ss', String(offset),
    '-i', inputPath,
    '-vframes', '1',
    '-vf', 'scale=360:-1',
    '-q:v', '3',
    outputPath,
  ]);
}

/**
 * Sanitize a filename: keep alphanumerics, dots, hyphens, underscores;
 * replace everything else with underscores; collapse consecutive underscores.
 */
export function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  let rawBase = filename;
  let ext = '';

  if (lastDot > 0) {
    rawBase = filename.slice(0, lastDot);
    ext = filename.slice(lastDot);
  } else if (lastDot === 0) {
    rawBase = '';
    ext = filename;
  }

  const base = rawBase || 'file';

  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return (sanitized || 'file') + ext.toLowerCase();
}
