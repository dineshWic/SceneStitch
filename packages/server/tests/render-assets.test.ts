import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectSchema } from '@scenestitch/core';
import { serveRenderAssets } from '../src/services/render-assets.js';
describe('Render asset server', () => {
  it('serves declared media ranges and hides other project files', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ss-media-'));
    const project = ProjectSchema.parse({
      name: 'Media',
      settings: {},
      assets: [{ id: 'a', type: 'audio', path: 'clip.wav' }],
    });
    await fs.writeFile(path.join(directory, 'clip.wav'), '0123456789');
    await fs.writeFile(path.join(directory, 'project.json'), 'private');
    const server = await serveRenderAssets(project, directory);
    try {
      const url = server.project.assets[0]!.path;
      const response = await fetch(url, { headers: { Range: 'bytes=2-5' } });
      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
      expect(await response.text()).toBe('2345');
      expect((await fetch(new URL('/project.json', url))).status).toBe(404);
      expect((await fetch(url, { headers: { Range: 'bytes=20-' } })).status).toBe(416);
    } finally {
      await server.close();
      await fs.rm(directory, { recursive: true, force: true });
    }
    project.assets[0]!.path = '../outside.wav';
    await expect(serveRenderAssets(project, directory)).rejects.toThrow('outside project');
  });
});
