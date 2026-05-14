import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { BackendConfig } from './config/env.js';
import { registerTaskRoutes } from './modules/task/task.controller.js';

export const buildApp = async (config: BackendConfig) => {
  const app = Fastify({ logger: { level: config.logLevel } });

  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', service: 'hotel-scout-agent-backend' }));

  await registerTaskRoutes(app);

  return app;
};
