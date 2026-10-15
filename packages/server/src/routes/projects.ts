import type { FastifyInstance } from 'fastify';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
} from '../services/project.js';

export async function projectRoutes(
  fastify: FastifyInstance,
  options: { dataDir: string },
): Promise<void> {
  const { dataDir } = options;

  // GET /projects
  fastify.get('/projects', async (_req, reply) => {
    const projects = await listProjects(dataDir);
    return reply.send(projects);
  });

  // POST /projects
  fastify.post<{ Body: { name: string; settings?: Record<string, unknown> } }>(
    '/projects',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            settings: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      const project = await createProject(dataDir, {
        name: req.body.name,
        settings: req.body.settings as Record<string, number | string>,
      });
      return reply.status(201).send(project);
    },
  );

  // GET /projects/:id
  fastify.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const project = await getProject(dataDir, req.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return reply.send(project);
  });

  // PUT /projects/:id
  fastify.put<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>('/projects/:id', async (req, reply) => {
    const updated = await updateProject(dataDir, req.params.id, req.body as never);
    if (!updated) return reply.status(404).send({ error: 'Project not found' });
    return reply.send(updated);
  });

  // DELETE /projects/:id
  fastify.delete<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const ok = await deleteProject(dataDir, req.params.id);
    if (!ok) return reply.status(404).send({ error: 'Project not found' });
    return reply.status(204).send();
  });
}
