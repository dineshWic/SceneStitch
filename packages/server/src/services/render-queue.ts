import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Project } from '@scenestitch/core';
import { safeProjectPath } from './project.js';
import type { renderProject, RenderJob } from './render.js';

export type RenderExecutor = typeof renderProject;
const JobSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  draft: z.boolean(),
  status: z.enum(['queued', 'running', 'done', 'failed', 'cancelled']),
  progress: z.number().min(0).max(1),
  logs: z.array(z.string()),
  output: z.string().optional(),
  verification: z.record(z.string(), z.unknown()).optional(),
});

/** A single worker with durable job state. Interrupted work is reported, never silently retried. */
export class RenderQueue {
  private jobs = new Map<string, RenderJob>();
  private controllers = new Map<string, AbortController>();
  private pending = Promise.resolve();
  private writes = new Map<string, Promise<void>>();
  private closed = false;
  constructor(
    private dataDir: string,
    private execute?: RenderExecutor,
  ) {}

  async init(): Promise<void> {
    const directory = path.join(this.dataDir, '.jobs');
    await fs.mkdir(directory, { recursive: true });
    for (const filename of await fs.readdir(directory)) {
      if (!filename.endsWith('.json')) continue;
      try {
        const job = JobSchema.parse(
          JSON.parse(await fs.readFile(path.join(directory, filename), 'utf8')),
        );
        this.jobs.set(job.id, job);
        if (job.status === 'queued' || job.status === 'running') {
          job.status = 'failed';
          job.logs.push(
            'Server stopped before this export completed. Start a new export to retry.',
          );
          delete job.output;
          await this.persist(job);
        }
        if (job.status !== 'done') await this.removeJobFiles(job);
      } catch {
        /* A corrupt record must not prevent opening projects or other jobs. */
      }
    }
  }
  list(): RenderJob[] {
    return [...this.jobs.values()].map((job) => structuredClone(job));
  }
  get(id: string): RenderJob | undefined {
    const job = this.jobs.get(id);
    return job ? structuredClone(job) : undefined;
  }

  async enqueue(projectId: string, project: Project, draft: boolean): Promise<RenderJob> {
    if (this.closed) throw new Error('The export queue is shutting down');
    const directory = path.dirname(safeProjectPath(this.dataDir, projectId, 'project.json'));
    const job: RenderJob = {
      id: randomUUID(),
      projectId,
      draft,
      status: 'queued',
      progress: 0,
      logs: ['Export queued'],
    };
    const controller = new AbortController();
    const snapshot = structuredClone(project);
    this.jobs.set(job.id, job);
    this.controllers.set(job.id, controller);
    try {
      await this.persist(job);
    } catch (error) {
      this.jobs.delete(job.id);
      this.controllers.delete(job.id);
      throw error;
    }
    this.pending = this.pending.then(async () => {
      try {
        if (controller.signal.aborted) return;
        job.status = 'running';
        job.logs.push('Export started');
        await this.persist(job);
        const execute = this.execute ?? (await import('./render.js')).renderProject;
        job.verification = await execute(
          snapshot,
          directory,
          path.join(directory, 'exports', `${job.id}.mp4`),
          {
            draft,
            signal: controller.signal,
            onProgress: (progress, message) => {
              job.progress = Math.max(0, Math.min(1, progress));
              if (job.logs.at(-1) !== message) job.logs.push(message);
            },
          },
        );
        if (controller.signal.aborted) throw new Error('Render cancelled');
        job.status = 'done';
        job.progress = 1;
        job.output = `/projects/${projectId}/files/exports/${job.id}.mp4`;
      } catch (error) {
        job.status = controller.signal.aborted ? 'cancelled' : 'failed';
        job.logs.push(error instanceof Error ? error.message : String(error));
        delete job.output;
      } finally {
        this.controllers.delete(job.id);
        if (job.status !== 'done')
          await this.removeJobFiles(job).catch((error: unknown) =>
            job.logs.push(`Unable to clean export files: ${String(error)}`),
          );
        await this.persist(job).catch((error: unknown) => {
          job.logs.push(`Unable to save export log: ${String(error)}`);
        });
      }
    });
    return structuredClone(job);
  }
  async cancel(id: string): Promise<RenderJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'cancelled';
      job.logs.push('Export cancelled');
      this.controllers.get(id)?.abort();
      await this.persist(job);
    }
    return structuredClone(job);
  }
  async idle(): Promise<void> {
    await this.pending;
  }
  async close(): Promise<void> {
    this.closed = true;
    for (const id of this.controllers.keys()) await this.cancel(id);
    await this.pending;
  }
  private async persist(job: RenderJob): Promise<void> {
    // Serialize snapshots before waiting: a later mutation cannot change an earlier state write.
    const text = JSON.stringify(job, null, 2);
    const previous = this.writes.get(job.id) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const directory = path.join(this.dataDir, '.jobs');
        await fs.mkdir(directory, { recursive: true });
        const destination = path.join(directory, `${job.id}.json`);
        const temporary = `${destination}.${randomUUID()}.tmp`;
        try {
          await fs.writeFile(temporary, text);
          await fs.rename(temporary, destination);
        } finally {
          await fs.rm(temporary, { force: true });
        }
      });
    this.writes.set(job.id, next);
    try {
      await next;
    } finally {
      if (this.writes.get(job.id) === next) this.writes.delete(job.id);
    }
  }
  private async removeJobFiles(job: RenderJob): Promise<void> {
    const output = safeProjectPath(this.dataDir, job.projectId, `exports/${job.id}.mp4`);
    for (const suffix of ['', '.partial.mp4', '.normalized.mp4', '.srt', '.credits.txt', '.wav'])
      await fs.rm(`${output}${suffix}`, { force: true });
  }
}
