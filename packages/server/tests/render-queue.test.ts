import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { RenderQueue } from '../src/services/render-queue.js';
import { createProject } from '../src/services/project.js';
const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ss-queue-'));
  directories.push(dir);
  const project = await createProject(dir, { name: 'Queued video' });
  return { dir, project };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
describe('Durable sequential exports', () => {
  it('skips a cancelled waiting job, continues after failure and reloads completed logs', async () => {
    const { dir, project } = await fixture();
    const started = deferred();
    const release = deferred();
    const calls: string[] = [];
    const queue = new RenderQueue(dir, async (snapshot) => {
      calls.push(snapshot.name);
      if (calls.length === 1) {
        started.resolve();
        await release.promise;
        throw new Error('Test encoding failure');
      }
      return { duration: 1 };
    });
    await queue.init();
    const first = await queue.enqueue(project.id, project, false);
    await started.promise;
    const second = await queue.enqueue(project.id, { ...project, name: 'Skipped' }, true);
    const third = await queue.enqueue(project.id, { ...project, name: 'Last' }, false);
    expect((await queue.cancel(second.id))?.status).toBe('cancelled');
    release.resolve();
    await queue.idle();
    expect(calls).toEqual(['Queued video', 'Last']);
    expect(queue.get(first.id)?.status).toBe('failed');
    expect(queue.get(third.id)).toMatchObject({
      status: 'done',
      progress: 1,
      verification: { duration: 1 },
    });
    await queue.close();
    const recovered = new RenderQueue(dir);
    await recovered.init();
    expect(recovered.get(first.id)?.logs).toContain('Test encoding failure');
    expect(recovered.get(second.id)?.status).toBe('cancelled');
    expect(recovered.get(third.id)?.status).toBe('done');
    await recovered.close();
  });
  it('cancels active encoding and removes incomplete video and sidecars', async () => {
    const { dir, project } = await fixture();
    const started = deferred();
    const queue = new RenderQueue(dir, async (_project, _directory, output, options) => {
      await fs.writeFile(`${output}.partial.mp4`, 'partial');
      await fs.writeFile(`${output}.srt`, 'partial subtitles');
      started.resolve();
      await new Promise<void>((_resolve, reject) =>
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        }),
      );
      return {};
    });
    await queue.init();
    const job = await queue.enqueue(project.id, project, false);
    await started.promise;
    await queue.cancel(job.id);
    await queue.idle();
    expect(queue.get(job.id)?.status).toBe('cancelled');
    expect(await fs.readdir(path.join(dir, project.id, 'exports'))).toEqual([]);
    await queue.close();
  });
  it('reports interrupted jobs after restart and cleans their files without touching completed exports', async () => {
    const { dir, project } = await fixture();
    const interrupted = randomUUID();
    const completed = randomUUID();
    await fs.mkdir(path.join(dir, '.jobs'));
    for (const [id, status] of [
      [interrupted, 'running'],
      [completed, 'done'],
    ]) {
      await fs.writeFile(
        path.join(dir, '.jobs', `${id}.json`),
        JSON.stringify({
          id,
          projectId: project.id,
          draft: false,
          status,
          progress: 0.5,
          logs: [],
        }),
      );
      await fs.writeFile(path.join(dir, project.id, 'exports', `${id}.mp4`), 'video');
    }
    await fs.writeFile(path.join(dir, '.jobs', 'corrupt.json'), 'invalid');
    const queue = new RenderQueue(dir);
    await queue.init();
    expect(queue.get(interrupted)?.status).toBe('failed');
    expect(queue.get(interrupted)?.logs.join(' ')).toContain('Server stopped');
    expect(await fs.readdir(path.join(dir, project.id, 'exports'))).toEqual([`${completed}.mp4`]);
    await queue.close();
  });
});
