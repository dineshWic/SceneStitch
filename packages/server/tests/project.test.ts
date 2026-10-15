import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
} from '../src/services/project.js';

let tmpDir: string;

async function makeTmpDir() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ss-test-'));
  return tmpDir;
}

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

describe('Project Service', () => {
  it('creates a project with the correct folder structure', async () => {
    const dataDir = await makeTmpDir();
    const project = await createProject(dataDir, { name: 'Test Project' });

    expect(project.name).toBe('Test Project');
    expect(project.schemaVersion).toBe(1);
    expect(project.settings.fps).toBe(30);
    expect(project.settings.width).toBe(1080);
    expect(project.settings.height).toBe(1920);
    expect(project.assets).toHaveLength(0);
    expect(project.scenes).toHaveLength(0);

    const id = (project as { id: string }).id;
    const projectDir = path.join(dataDir, id);

    // Verify folder structure
    await expect(fs.access(path.join(projectDir, 'project.json'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(projectDir, 'media', 'original'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(projectDir, 'media', 'work'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(projectDir, 'thumbs'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(projectDir, 'exports'))).resolves.toBeUndefined();
  });

  it('writes project.json atomically (file is valid JSON immediately)', async () => {
    const dataDir = await makeTmpDir();
    const project = await createProject(dataDir, { name: 'Atomic Write Test' });
    const id = (project as { id: string }).id;

    const raw = await fs.readFile(path.join(dataDir, id, 'project.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.name).toBe('Atomic Write Test');
  });

  it('lists all projects', async () => {
    const dataDir = await makeTmpDir();
    await createProject(dataDir, { name: 'Project A' });
    await createProject(dataDir, { name: 'Project B' });

    const projects = await listProjects(dataDir);
    expect(projects).toHaveLength(2);
    const names = projects.map((p) => p.name).sort();
    expect(names).toEqual(['Project A', 'Project B']);
  });

  it('returns empty list when dataDir does not exist', async () => {
    const projects = await listProjects('/nonexistent/path/xyz');
    expect(projects).toHaveLength(0);
  });

  it('reads a project by ID', async () => {
    const dataDir = await makeTmpDir();
    const created = await createProject(dataDir, { name: 'Read Test' });
    const id = (created as { id: string }).id;

    const found = await getProject(dataDir, id);
    expect(found?.name).toBe('Read Test');
    expect((found as { id: string } | null)?.id).toBe(id);
  });

  it('returns null for a non-existent project ID', async () => {
    const dataDir = await makeTmpDir();
    const result = await getProject(dataDir, 'does-not-exist');
    expect(result).toBeNull();
  });

  it('updates a project field', async () => {
    const dataDir = await makeTmpDir();
    const project = await createProject(dataDir, { name: 'Original Name' });
    const id = (project as { id: string }).id;

    const updated = await updateProject(dataDir, id, { name: 'New Name' });
    expect(updated?.name).toBe('New Name');

    // Verify persisted to disk
    const reloaded = await getProject(dataDir, id);
    expect(reloaded?.name).toBe('New Name');
  });

  it('deletes a project and its folder', async () => {
    const dataDir = await makeTmpDir();
    const project = await createProject(dataDir, { name: 'To Delete' });
    const id = (project as { id: string }).id;

    const ok = await deleteProject(dataDir, id);
    expect(ok).toBe(true);

    const found = await getProject(dataDir, id);
    expect(found).toBeNull();
  });
});
