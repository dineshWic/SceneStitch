import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveVisual, type Project } from '@scenestitch/core';
const exec = promisify(execFile);

/** Reduce decode/raster work for drafts while keeping project timing and composition unchanged. */
export async function draftProxies(
  project: Project,
  directory: string,
  scale: number,
  signal?: AbortSignal,
): Promise<Project> {
  const root = path.resolve(directory);
  const used = new Set<string>();
  for (const scene of project.scenes) {
    for (const side of scene.template ? (['left', 'right'] as const) : [undefined]) {
      const asset = resolveVisual(project, scene.id, side);
      if (asset) used.add(asset.id);
    }
  }
  const width = Math.max(2, Math.floor((project.settings.width * scale) / 2) * 2);
  const height = Math.max(2, Math.floor((project.settings.height * scale) / 2) * 2);
  const cache = path.join(root, 'cache', 'draft');
  await fs.mkdir(cache, { recursive: true });
  const assets = [];
  for (const asset of project.assets) {
    signal?.throwIfAborted();
    if (asset.type === 'audio' || !used.has(asset.id)) {
      assets.push(asset);
      continue;
    }
    const source = path.resolve(root, asset.path);
    if (!source.startsWith(root + path.sep)) throw new Error('Draft source is outside project');
    const stat = await fs.stat(source);
    const key = createHash('sha256')
      .update(
        JSON.stringify([
          asset.path,
          stat.size,
          stat.mtimeMs,
          width,
          height,
          project.settings.fps,
          'v1',
        ]),
      )
      .digest('hex');
    const extension = asset.type === 'video' ? '.mp4' : '.png';
    const output = path.join(cache, `${key}${extension}`);
    if (!(await fs.stat(output).catch(() => null))?.size) {
      const temporary = path.join(cache, `${key}-${randomUUID()}.partial${extension}`);
      try {
        const filter = `scale=w='min(iw,${width})':h='min(ih,${height})':force_original_aspect_ratio=decrease:force_divisible_by=2`;
        await exec(
          'ffmpeg',
          [
            '-v',
            'error',
            '-y',
            '-i',
            source,
            '-vf',
            filter,
            ...(asset.type === 'video'
              ? [
                  '-an',
                  '-c:v',
                  'libx264',
                  '-preset',
                  'ultrafast',
                  '-crf',
                  '23',
                  '-pix_fmt',
                  'yuv420p',
                  '-movflags',
                  '+faststart',
                ]
              : ['-frames:v', '1']),
            temporary,
          ],
          { signal, maxBuffer: 16 * 1024 * 1024 },
        );
        signal?.throwIfAborted();
        await fs.rename(temporary, output);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }
    assets.push({ ...asset, path: path.relative(root, output).replace(/\\/g, '/') });
  }
  return { ...project, assets };
}
