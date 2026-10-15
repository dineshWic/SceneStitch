import type { FastifyInstance } from 'fastify';
import { parseTimelineTable, validateTimeline } from '@scenestitch/core';

export async function timelineRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /parse-timeline
  // Accepts a plain-text body (Markdown table, CSV, or TSV)
  fastify.post<{ Body: string }>(
    '/parse-timeline',
    {
      schema: {
        body: { type: 'string' },
      },
    },
    async (req, reply) => {
      const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const { scenes, errors: parseErrors } = parseTimelineTable(text);
      const validationErrors = scenes.length > 0 ? validateTimeline(scenes) : [];

      return reply.send({
        scenes,
        parseErrors,
        validationErrors,
        ok: parseErrors.length === 0 && validationErrors.length === 0,
      });
    },
  );
}
