import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { projectRoutes } from './routes/projects.js';
import { assetRoutes } from './routes/assets.js';
import { timelineRoutes } from './routes/timeline.js';
import { workflowRoutes } from './routes/workflow.js';

export interface AppOptions {
  dataDir: string;
  logger?: boolean;
  /** Max upload file size in bytes (default: 2 GB) */
  maxFileSize?: number;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { dataDir, logger = false, maxFileSize = 2 * 1024 * 1024 * 1024 } = options;

  const fastify = Fastify({
    logger,
    rewriteUrl: (req) => (req.url?.startsWith('/api/') ? req.url.slice(4) : (req.url ?? '/')),
  });

  // CORS: only allow localhost dev UI origins
  fastify.register(cors, {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });

  // Multipart for file uploads
  fastify.register(multipart, {
    limits: { fileSize: maxFileSize },
  });

  // Routes
  fastify.register(projectRoutes, { dataDir });
  fastify.register(assetRoutes, { dataDir });
  fastify.register(timelineRoutes);
  fastify.register(workflowRoutes, { dataDir });
  fastify.setErrorHandler((error, _req, reply) => {
    const e = error as Error & { statusCode?: number };
    const status = e.name === 'ZodError' ? 400 : (e.statusCode ?? 500);
    reply.code(status).send({ error: e.message });
  });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  return fastify;
}
