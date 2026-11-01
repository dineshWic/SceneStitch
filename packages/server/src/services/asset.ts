import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import type { Asset } from '@scenestitch/core';
import { probeFile } from './ffprobe.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeVideo, generateThumbnail, sanitizeFilename } from './ffmpeg.js';
import {
  getProject,
  addAssetToProject,
  getOriginalDir,
  getWorkDir,
  getThumbDir,
} from './project.js';

export interface UploadResult {
  asset: Asset;
  probe: Awaited<ReturnType<typeof probeFile>>;
  workPath: string;
  thumbPath: string;
}

/**
 * Import an asset:
 * 1. Save original (untouched) to media/original/<sanitized-name>
 * 2. ffprobe to get metadata
 * 3. Normalize to media/work/<id>.mp4  (video) or copy as-is (image)
 * 4. Generate thumbnail thumbs/<id>.jpg
 * 5. Append asset record to project.json atomically
 */
export async function importAsset(
  dataDir: string,
  projectId: string,
  sourceBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
): Promise<UploadResult | null> {
  const project = await getProject(dataDir, projectId);
  if (!project) return null;

  const sanitized = sanitizeFilename(originalFilename);
  const assetId = uuidv4();
  const ext = path.extname(sanitized).toLowerCase();

  const isVideo =
    mimeType.startsWith('video/') ||
    ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mts', '.m4v'].includes(ext);
  const isImage =
    mimeType.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext);
  if (!isVideo && !isImage && !['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'].includes(ext))
    throw Object.assign(new Error('Unsupported media format'), { statusCode: 400 });

  // 1. Save original
  const originalDir = getOriginalDir(dataDir, projectId);
  const originalPath = path.join(originalDir, `${assetId}-${sanitized}`);
  await fs.writeFile(originalPath, sourceBuffer);

  // 2. Probe
  const probe = await probeFile(originalPath);

  // 3. Normalize / copy
  const workDir = getWorkDir(dataDir, projectId);
  let workFilename: string;
  let assetType: Asset['type'];

  if (isVideo) {
    workFilename = `${assetId}.mp4`;
    assetType = 'video';
    await normalizeVideo(originalPath, path.join(workDir, workFilename), {
      targetFps: project.settings.fps,
    });
  } else if (isImage) {
    workFilename = `${assetId}${ext}`;
    assetType = 'image';
    await fs.copyFile(originalPath, path.join(workDir, workFilename));
  } else {
    workFilename = `${assetId}${ext}`;
    assetType = 'audio';
    await fs.copyFile(originalPath, path.join(workDir, workFilename));
  }

  const workPath = path.join('media', 'work', workFilename);

  // 4. Thumbnail
  const thumbDir = getThumbDir(dataDir, projectId);
  const thumbFilename = `${assetId}.jpg`;
  const thumbAbsPath = path.join(thumbDir, thumbFilename);

  if (isVideo || isImage) {
    await generateThumbnail(originalPath, thumbAbsPath, isVideo ? probe.duration : undefined);
  }

  const thumbPath = path.join('thumbs', thumbFilename);

  // 5. Build asset record
  const asset: Asset = {
    id: assetId,
    type: assetType,
    path: workPath,
    name: originalFilename,
    width: probe.width,
    height: probe.height,
    fps: probe.fps,
    rotation: probe.rotation,
    ...(isImage || isVideo ? { thumbnail: thumbPath } : {}),
    ...(isVideo || assetType === 'audio' ? { duration: probe.duration } : {}),
    ...(isVideo ? { hasAudio: probe.hasAudio } : {}),
  };
  if (assetType === 'audio') {
    const { stdout } = await promisify(execFile)(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        path.join(workDir, workFilename),
        '-ac',
        '1',
        '-ar',
        '100',
        '-f',
        'f32le',
        'pipe:1',
      ],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
    );
    const peaks: number[] = [];
    const samples = Math.floor(stdout.length / 4);
    const step = Math.max(1, Math.ceil(samples / 200));
    for (let i = 0; i < samples; i += step) {
      let peak = 0;
      for (let j = i; j < Math.min(samples, i + step); j++)
        peak = Math.max(peak, Math.abs(stdout.readFloatLE(j * 4)));
      peaks.push(Math.min(1, peak));
    }
    asset.peaks = peaks;
  }

  // 6. Append to project.json
  await addAssetToProject(dataDir, projectId, asset);

  return { asset, probe, workPath, thumbPath };
}
