import type { FastifyInstance } from 'fastify';
import { notImplemented } from '../../shared/http.js';

export const registerTaskRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/api/tasks', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Task creation'));
  });

  app.get('/api/tasks/:taskId', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Task detail query'));
  });

  app.post('/api/tasks/:taskId/pause', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Task pause'));
  });

  app.post('/api/tasks/:taskId/resume', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Task resume'));
  });

  app.post('/api/tasks/:taskId/platforms/:platform/skip', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Platform skip'));
  });

  app.get('/api/tasks/:taskId/results', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Task results query'));
  });

  app.get('/api/tasks/:taskId/events', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Task event stream'));
  });
};
