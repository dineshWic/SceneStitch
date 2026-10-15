import type { FastifyInstance } from 'fastify';
import { importAsset } from '../services/asset.js';
import { getProject } from '../services/project.js';

export async function assetRoutes(
  fastify: FastifyInstance,
  options: { dataDir: string },
): Promise<void> {
  const { dataDir } = options;

  // POST /projects/:id/assets  (multipart upload)
  fastify.post<{ Params: { id: string } }>('/projects/:id/assets', async (req, reply) => {
    const project = await getProject(dataDir, req.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const filename = data.filename ?? 'upload';
    const mimetype = data.mimetype ?? 'application/octet-stream';

    const result = await importAsset(dataDir, req.params.id, buffer, filename, mimetype);

    if (!result) {
      return reply.status(404).send({ error: 'Project not found during import' });
    }

    return reply.status(201).send({
      asset: result.asset,
      probe: result.probe,
      workPath: result.workPath,
      thumbPath: result.thumbPath,
    });
  });

  // GET /projects/:id/assets
  fastify.get<{ Params: { id: string } }>('/projects/:id/assets', async (req, reply) => {
    const project = await getProject(dataDir, req.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return reply.send(project.assets ?? []);
  });
}
