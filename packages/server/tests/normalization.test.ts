import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createProject } from '../src/services/project.js';
import { importAsset } from '../src/services/asset.js';
import { probeFile } from '../src/services/ffprobe.js';

const execFileAsync = promisify(execFile);

let tmpDir: string;

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

async function makeTmpDir() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ss-norm-test-'));
  return tmpDir;
}

describe('Step 5 Done When: Video Normalization', () => {
  it('imports a rotated, non-standard fps clip and normalizes it to constant 30 fps', async () => {
    const dataDir = await makeTmpDir();
    const project = await createProject(dataDir, { name: 'Normalization Project' });
    const projectId = project.id;

    // 1. Generate a synthetic test clip with rotation metadata (90 degrees) and non-standard 24 fps
    const rawClipPath = path.join(dataDir, 'raw_phone_clip.mkv');
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=1920x1080:rate=24',
      '-metadata:s:v:0',
      'ROTATE=90',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      rawClipPath,
    ]);

    // Verify raw clip has rotate=90 and ~24 fps
    const rawProbe = await probeFile(rawClipPath);
    expect(rawProbe.rotation).toBe(90);
    expect(rawProbe.fps).toBeCloseTo(24, 0);

    // 2. Import asset via importAsset
    const buffer = await fs.readFile(rawClipPath);
    const result = await importAsset(
      dataDir,
      projectId,
      buffer,
      'my phone clip.mkv',
      'video/x-matroska',
    );

    expect(result).not.toBeNull();
    const workFileAbs = path.join(dataDir, projectId, result!.workPath);

    // 3. Probe the normalized working copy
    const workProbe = await probeFile(workFileAbs);

    // Working copy must be constant 30 fps
    expect(workProbe.fps).toBe(30);

    // FFmpeg normalizes to MP4 at 30 fps
    expect(workProbe.format).toContain('mp4');
    expect(workProbe.width).toBeGreaterThan(0);
    expect(workProbe.height).toBeGreaterThan(0);
    expect(workProbe.duration).toBeGreaterThan(1.8);

    // Check thumbnail was generated
    const thumbAbs = path.join(dataDir, projectId, result!.thumbPath);
    await expect(fs.access(thumbAbs)).resolves.toBeUndefined();
  }, 30000);
});
