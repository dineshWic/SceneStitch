import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildApp } from '../src/app.js';
import {
  createProject,
  updateProject,
  safeProjectPath,
  duplicateProject,
  listSnapshots,
  restoreSnapshot,
} from '../src/services/project.js';
const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});
async function directory() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ss-workflow-'));
  dirs.push(dir);
  return dir;
}
describe('Persistence and API hardening', () => {
  it('rejects traversal, invalid settings and unsupported schema versions', async () => {
    const dir = await directory();
    expect(() => safeProjectPath(dir, '../outside', 'project.json')).toThrow();
    expect(() => safeProjectPath(dir, 'valid', '../../outside')).toThrow();
    const p = await createProject(dir, { name: 'Safe' });
    await expect(
      updateProject(dir, p.id, { settings: { ...p.settings, width: -1 } }),
    ).rejects.toThrow();
    const app = buildApp({ dataDir: dir });
    try {
      const result = await app.inject({
        method: 'PUT',
        url: `/projects/${p.id}`,
        payload: { scenes: 'invalid' },
      });
      expect(result.statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
  it('retains snapshots and duplicates media independently', async () => {
    const dir = await directory();
    const p = await createProject(dir, { name: 'Original' });
    await fs.writeFile(path.join(dir, p.id, 'media/work/test.txt'), 'asset');
    await updateProject(dir, p.id, { name: 'Edited' });
    const snapshots = await listSnapshots(dir, p.id);
    expect(snapshots).toHaveLength(1);
    const restored = await restoreSnapshot(dir, p.id, snapshots[0]!);
    expect(restored?.name).toBe('Original');
    const copy = await duplicateProject(dir, p.id);
    expect(copy?.id).not.toBe(p.id);
    expect(await fs.readFile(path.join(dir, copy!.id, 'media/work/test.txt'), 'utf8')).toBe(
      'asset',
    );
  });
});
