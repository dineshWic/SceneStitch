import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { buildApp } from '../src/app.js';

let tmpDir: string;

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

async function makeTmpDir() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ss-api-test-'));
  return tmpDir;
}

describe('API Routes', () => {
  it('GET /health returns ok', async () => {
    const dataDir = await makeTmpDir();
    const app = buildApp({ dataDir });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
    await app.close();
  });

  describe('Projects CRUD', () => {
    it('creates and lists a project', async () => {
      const dataDir = await makeTmpDir();
      const app = buildApp({ dataDir });
      await app.ready();

      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'My Project' },
      });
      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.body);
      expect(created.name).toBe('My Project');
      expect(created.id).toBeTruthy();

      // List
      const listRes = await app.inject({ method: 'GET', url: '/projects' });
      expect(listRes.statusCode).toBe(200);
      const list = JSON.parse(listRes.body);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('My Project');

      await app.close();
    });

    it('GET /projects/:id returns 404 for missing project', async () => {
      const dataDir = await makeTmpDir();
      const app = buildApp({ dataDir });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/projects/nonexistent-id' });
      expect(res.statusCode).toBe(404);

      await app.close();
    });

    it('creates, reads, updates, and deletes a project', async () => {
      const dataDir = await makeTmpDir();
      const app = buildApp({ dataDir });
      await app.ready();

      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'CRUD Test' },
      });
      const { id } = JSON.parse(createRes.body);

      // Read
      const readRes = await app.inject({ method: 'GET', url: `/projects/${id}` });
      expect(readRes.statusCode).toBe(200);
      expect(JSON.parse(readRes.body).name).toBe('CRUD Test');

      // Update
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/projects/${id}`,
        payload: { name: 'Updated Name' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.body).name).toBe('Updated Name');

      // Delete
      const delRes = await app.inject({ method: 'DELETE', url: `/projects/${id}` });
      expect(delRes.statusCode).toBe(204);

      // Confirm gone
      const gone = await app.inject({ method: 'GET', url: `/projects/${id}` });
      expect(gone.statusCode).toBe(404);

      await app.close();
    });
  });

  describe('Timeline Parse Endpoint', () => {
    it('POST /parse-timeline parses the capybara Markdown table', async () => {
      const dataDir = await makeTmpDir();
      const app = buildApp({ dataDir });
      await app.ready();

      const table = `
| Time | Scene | Story beat |
|---|---|---|
| 0.0–2.2 s | 1 | Hook |
| 2.2–4.5 s | 2 | Muddy |
| 4.5–7.3 s | 3 | Warm rinse |
| 7.3–10.1 s | 4 | Foam bath |
| 10.1–13.0 s | 5 | Brush |
| 13.0–16.1 s | 6 | Rinse reveal |
| 16.1–19.3 s | 7 | Blow dry |
| 19.3–22.3 s | 8 | Styling |
| 22.3–27.2 s | 9 | Glamour reveal |
| 27.2–30.0 s | 10 | Before/after CTA |
`;

      const res = await app.inject({
        method: 'POST',
        url: '/parse-timeline',
        headers: { 'content-type': 'text/plain' },
        payload: table,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.scenes).toHaveLength(10);
      expect(body.parseErrors).toHaveLength(0);
      expect(body.validationErrors).toHaveLength(0);
      expect(body.ok).toBe(true);

      await app.close();
    });

    it('POST /parse-timeline returns validation errors for a gapped timeline', async () => {
      const dataDir = await makeTmpDir();
      const app = buildApp({ dataDir });
      await app.ready();

      const gappedCsv = `Time,Scene,Story
0.0-2.0s,1,First
3.0-5.0s,2,Second with gap`;

      const res = await app.inject({
        method: 'POST',
        url: '/parse-timeline',
        headers: { 'content-type': 'text/plain' },
        payload: gappedCsv,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(false);
      expect(body.validationErrors.some((e: { code: string }) => e.code === 'GAP_DETECTED')).toBe(
        true,
      );

      await app.close();
    });
  });
});
