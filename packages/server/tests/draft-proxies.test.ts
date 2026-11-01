import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ProjectSchema } from '@scenestitch/core';
import { draftProxies } from '../src/services/draft-proxies.js';
import { probeFile } from '../src/services/ffprobe.js';
describe('Draft proxies', () => {
  it('preserves video duration/fps, caches smaller media and leaves originals untouched', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ss-proxy-'));
    try {
      const source = path.join(directory, 'source.mp4');
      await promisify(execFile)('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=640x360:rate=30:duration=1',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        source,
      ]);
      const original = await fs.readFile(source);
      const project = ProjectSchema.parse({
        name: 'Proxy',
        settings: { width: 360, height: 640 },
        assets: [
          { id: 'video', type: 'video', path: 'source.mp4', duration: 1 },
          { id: 'unused', type: 'image', path: 'missing.png' },
        ],
        scenes: [{ id: 1, label: 'A', start: 0, end: 1, visual: { assetId: 'video' } }],
      });
      const proxy = await draftProxies(project, directory, 0.5);
      const destination = path.join(directory, proxy.assets[0]!.path);
      const probe = await probeFile(destination);
      expect(probe).toMatchObject({ duration: 1, fps: 30, codec: 'h264' });
      expect(probe.width).toBeLessThanOrEqual(180);
      expect(probe.height).toBeLessThanOrEqual(320);
      const before = (await fs.stat(destination)).mtimeMs;
      const again = await draftProxies(project, directory, 0.5);
      expect(again.assets[0]!.path).toBe(proxy.assets[0]!.path);
      expect((await fs.stat(destination)).mtimeMs).toBe(before);
      expect(await fs.readFile(source)).toEqual(original);
      expect(project.assets[0]!.path).toBe('source.mp4');
      expect(proxy.assets[1]!.path).toBe('missing.png');
      const controller = new AbortController();
      controller.abort();
      await expect(draftProxies(project, directory, 0.5, controller.signal)).rejects.toThrow();
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }, 30000);
});
