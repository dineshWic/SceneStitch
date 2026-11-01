import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { ProjectSchema, type Project, type Asset } from '@scenestitch/core';

const SCHEMA_VERSION = 1;

export interface CreateProjectInput {
  name: string;
  settings?: Partial<Project['settings']>;
}

function projectDir(dataDir: string, projectId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId))
    throw Object.assign(new Error('Invalid project ID'), { statusCode: 400 });
  return path.join(dataDir, projectId);
}

function projectJsonPath(dataDir: string, projectId: string): string {
  return path.join(projectDir(dataDir, projectId), 'project.json');
}

/**
 * Create project folder structure and write initial project.json atomically.
 * Folder layout:
 *   <dataDir>/<projectId>/
 *     project.json
 *     media/original/
 *     media/work/
 *     thumbs/
 *     exports/
 */
export async function createProject(
  dataDir: string,
  input: CreateProjectInput,
): Promise<Project & { id: string }> {
  const id = uuidv4();
  const dir = projectDir(dataDir, id);

  await fs.mkdir(path.join(dir, 'media', 'original'), { recursive: true });
  await fs.mkdir(path.join(dir, 'media', 'work'), { recursive: true });
  await fs.mkdir(path.join(dir, 'thumbs'), { recursive: true });
  await fs.mkdir(path.join(dir, 'exports'), { recursive: true });

  const project: Project = ProjectSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    name: input.name,
    settings: {
      width: 1080,
      height: 1920,
      fps: 30,
      defaultFit: 'trim',
      ...(input.settings ?? {}),
    },
    assets: [],
    scenes: [],
  });

  await writeProjectAtomic(dataDir, id, project);
  return { ...project, id } as Project & { id: string };
}

export async function listProjects(dataDir: string): Promise<Array<Project & { id: string }>> {
  let entries: string[];
  try {
    entries = await fs.readdir(dataDir);
  } catch {
    return [];
  }

  const results: Array<Project & { id: string }> = [];
  for (const entry of entries) {
    try {
      const raw = await fs.readFile(path.join(dataDir, entry, 'project.json'), 'utf-8');
      const project = JSON.parse(raw) as Project;
      results.push({ ...project, id: entry });
    } catch {
      // skip corrupted / non-project dirs
    }
  }
  return results;
}

export async function getProject(
  dataDir: string,
  projectId: string,
): Promise<(Project & { id: string }) | null> {
  try {
    const raw = await fs.readFile(projectJsonPath(dataDir, projectId), 'utf-8');
    const project = JSON.parse(raw) as Project;
    return { ...project, id: projectId };
  } catch {
    return null;
  }
}

export async function updateProject(
  dataDir: string,
  projectId: string,
  patch: Partial<Omit<Project, 'schemaVersion'>>,
): Promise<(Project & { id: string }) | null> {
  return withProjectLock(projectId, async () => {
    const existing = await getProject(dataDir, projectId);
    if (!existing) return null;

    const updated: Project = ProjectSchema.parse({
      ...existing,
      ...patch,
      schemaVersion: SCHEMA_VERSION,
    });
    await snapshotProject(dataDir, projectId, existing);
    await writeProjectAtomic(dataDir, projectId, updated);
    return { ...updated, id: projectId };
  });
}

export async function deleteProject(dataDir: string, projectId: string): Promise<boolean> {
  const dir = projectDir(dataDir, projectId);
  if (!(await getProject(dataDir, projectId))) return false;
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/** Append an asset to project.json atomically. */
export async function addAssetToProject(
  dataDir: string,
  projectId: string,
  asset: Asset,
): Promise<(Project & { id: string }) | null> {
  const project = await getProject(dataDir, projectId);
  if (!project) return null;

  const assets = [...(project.assets ?? []), asset];
  return updateProject(dataDir, projectId, { assets });
}

// ── Atomic write helper ────────────────────────────────────────────────────────

async function writeProjectAtomic(
  dataDir: string,
  projectId: string,
  project: Project,
): Promise<void> {
  const dest = projectJsonPath(dataDir, projectId);
  const tmp = `${dest}.tmp-${uuidv4()}`;
  await fs.writeFile(tmp, JSON.stringify(project, null, 2), 'utf-8');
  await fs.rename(tmp, dest);
}

// ── Path helpers (exported for use in asset/route layers) ─────────────────────

export function getOriginalDir(dataDir: string, projectId: string): string {
  return path.join(projectDir(dataDir, projectId), 'media', 'original');
}

export function getWorkDir(dataDir: string, projectId: string): string {
  return path.join(projectDir(dataDir, projectId), 'media', 'work');
}

export function getThumbDir(dataDir: string, projectId: string): string {
  return path.join(projectDir(dataDir, projectId), 'thumbs');
}

const locks = new Map<string, Promise<unknown>>();
async function withProjectLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}
async function snapshotProject(dataDir: string, id: string, project: Project): Promise<void> {
  const dir = path.join(projectDir(dataDir, id), 'snapshots');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${Date.now()}-${uuidv4()}.json`), JSON.stringify(project));
  const files = (await fs.readdir(dir)).sort().reverse();
  for (const file of files.slice(20)) await fs.unlink(path.join(dir, file));
}
export async function listSnapshots(dataDir: string, id: string): Promise<string[]> {
  return fs
    .readdir(path.join(projectDir(dataDir, id), 'snapshots'))
    .then((files) => files.sort().reverse())
    .catch(() => []);
}
export async function restoreSnapshot(dataDir: string, id: string, name: string) {
  if (!/^[\w-]+\.json$/.test(name)) throw new Error('Invalid snapshot');
  const project = ProjectSchema.parse(
    JSON.parse(await fs.readFile(path.join(projectDir(dataDir, id), 'snapshots', name), 'utf8')),
  );
  return updateProject(dataDir, id, project);
}
export async function duplicateProject(dataDir: string, id: string) {
  const source = await getProject(dataDir, id);
  if (!source) return null;
  const copy = await createProject(dataDir, {
    name: `${source.name} (copy)`,
    settings: source.settings,
  });
  await fs.cp(
    path.join(projectDir(dataDir, id), 'media'),
    path.join(projectDir(dataDir, copy.id), 'media'),
    { recursive: true },
  );
  await fs.cp(getThumbDir(dataDir, id), getThumbDir(dataDir, copy.id), { recursive: true });
  return updateProject(dataDir, copy.id, { ...source, name: copy.name });
}
export function safeProjectPath(dataDir: string, id: string, relative: string): string {
  const root = path.resolve(projectDir(dataDir, id));
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep))
    throw Object.assign(new Error('Invalid file path'), { statusCode: 400 });
  return target;
}
