import type { FastifyInstance, FastifyReply } from 'fastify';
import { apiError, notImplemented, ok } from '../../shared/http.js';
import { TaskService } from './task.service.js';
import type { ManualVerificationContext, PlatformCode, SearchCriteria, SortBy } from './task.types.js';

const PLATFORMS = new Set<PlatformCode>(['ctrip', 'booking', 'fliggy', 'meituan']);
const SORT_OPTIONS = new Set<SortBy>(['price', 'trust', 'distance']);

const taskService = new TaskService();

type TaskParams = {
  taskId: string;
};

type PlatformTaskParams = TaskParams & {
  platform: PlatformCode;
};

type ManualVerificationRequestBody = {
  reason?: unknown;
  screenshotPath?: unknown;
  resumeContext?: unknown;
};

type ManualVerificationResumeBody = {
  resumeContext?: unknown;
};

export const registerTaskRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post<{ Body: SearchCriteria }>('/api/tasks', async (request, reply) => {
    const validationError = validateSearchCriteria(request.body);
    if (validationError) {
      return reply.code(400).send(apiError('INVALID_SEARCH_CRITERIA', validationError));
    }

    const task = await taskService.createTask(request.body);
    const detail = await taskService.getTaskDetail(task.id);
    return reply.code(201).send(ok(detail));
  });

  app.get<{ Params: TaskParams }>('/api/tasks/:taskId', async (request, reply) => {
    const detail = await taskService.getTaskDetail(request.params.taskId);
    if (!detail) {
      return reply.code(404).send(apiError('TASK_NOT_FOUND', `Task not found: ${request.params.taskId}`));
    }

    return reply.send(ok(detail));
  });

  app.post<{ Params: TaskParams }>('/api/tasks/:taskId/pause', async (request, reply) => {
    try {
      const detail = await taskService.stopTask(request.params.taskId);
      return reply.send(ok(detail));
    } catch (error) {
      return sendTaskError(reply, error);
    }
  });

  app.post<{ Params: TaskParams }>('/api/tasks/:taskId/resume', async (request, reply) => {
    try {
      const detail = await taskService.enqueueTask(request.params.taskId);
      return reply.send(ok(detail));
    } catch (error) {
      return sendTaskError(reply, error);
    }
  });

  app.post<{ Params: PlatformTaskParams }>('/api/tasks/:taskId/platforms/:platform/skip', async (request, reply) => {
    if (!PLATFORMS.has(request.params.platform)) {
      return reply.code(400).send(apiError('INVALID_PLATFORM', `Unsupported platform: ${request.params.platform}`));
    }

    try {
      const platformTask = await taskService.transitionPlatformTask(request.params.taskId, request.params.platform, 'skipped', {
        currentStep: '用户已跳过该平台',
      });
      return reply.send(ok(platformTask));
    } catch (error) {
      return sendTaskError(reply, error);
    }
  });


  app.post<{ Params: PlatformTaskParams; Body: ManualVerificationRequestBody }>(
    '/api/tasks/:taskId/platforms/:platform/manual-verification',
    async (request, reply) => {
      if (!PLATFORMS.has(request.params.platform)) {
        return reply.code(400).send(apiError('INVALID_PLATFORM', `Unsupported platform: ${request.params.platform}`));
      }

      const validationError = validateManualVerificationRequest(request.body);
      if (validationError) {
        return reply.code(400).send(apiError('INVALID_MANUAL_VERIFICATION_REQUEST', validationError));
      }

      try {
        const detail = await taskService.requestManualVerification({
          taskId: request.params.taskId,
          platform: request.params.platform,
          reason: request.body.reason as string,
          screenshotPath: request.body.screenshotPath as string | undefined,
          resumeContext: request.body.resumeContext as ManualVerificationContext | undefined,
        });
        return reply.send(ok(detail));
      } catch (error) {
        return sendTaskError(reply, error);
      }
    },
  );

  app.post<{ Params: PlatformTaskParams; Body: ManualVerificationResumeBody }>(
    '/api/tasks/:taskId/platforms/:platform/manual-verification/resume',
    async (request, reply) => {
      if (!PLATFORMS.has(request.params.platform)) {
        return reply.code(400).send(apiError('INVALID_PLATFORM', `Unsupported platform: ${request.params.platform}`));
      }

      const validationError = validateManualVerificationResume(request.body);
      if (validationError) {
        return reply.code(400).send(apiError('INVALID_MANUAL_VERIFICATION_RESUME', validationError));
      }

      try {
        const detail = await taskService.resumeManualVerification({
          taskId: request.params.taskId,
          platform: request.params.platform,
          resumeContext: request.body?.resumeContext as ManualVerificationContext | undefined,
        });
        return reply.send(ok(detail));
      } catch (error) {
        return sendTaskError(reply, error);
      }
    },
  );

  app.get<{ Params: TaskParams }>('/api/tasks/:taskId/results', async (request, reply) => {
    const results = await taskService.getTaskResults(request.params.taskId);
    if (!results) {
      return reply.code(404).send(apiError('TASK_NOT_FOUND', `Task not found: ${request.params.taskId}`));
    }

    return reply.send(ok(results));
  });

  app.get('/api/tasks/:taskId/events', async (_request, reply) => {
    return reply.code(501).send(notImplemented('Task event stream'));
  });
};

const validateSearchCriteria = (body: SearchCriteria | undefined): string | null => {
  if (!body || typeof body !== 'object') {
    return 'Request body is required.';
  }

  if (!body.destination || typeof body.destination !== 'string' || body.destination.trim().length === 0) {
    return 'destination is required.';
  }

  if (!isIsoDate(body.checkInDate)) {
    return 'checkInDate must use YYYY-MM-DD format.';
  }

  if (!isIsoDate(body.checkOutDate)) {
    return 'checkOutDate must use YYYY-MM-DD format.';
  }

  if (body.checkInDate >= body.checkOutDate) {
    return 'checkOutDate must be later than checkInDate.';
  }

  if (!Number.isInteger(body.adults) || body.adults < 1) {
    return 'adults must be a positive integer.';
  }

  if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
    return 'platforms must contain at least one platform.';
  }

  const unsupportedPlatform = body.platforms.find((platform) => !PLATFORMS.has(platform));
  if (unsupportedPlatform) {
    return `Unsupported platform: ${unsupportedPlatform}`;
  }

  if (!SORT_OPTIONS.has(body.sortBy)) {
    return 'sortBy must be one of price, trust, distance.';
  }

  if (body.priceMin !== undefined && (typeof body.priceMin !== 'number' || body.priceMin < 0)) {
    return 'priceMin must be a non-negative number when provided.';
  }

  if (body.priceMax !== undefined && (typeof body.priceMax !== 'number' || body.priceMax < 0)) {
    return 'priceMax must be a non-negative number when provided.';
  }

  if (body.priceMin !== undefined && body.priceMax !== undefined && body.priceMin > body.priceMax) {
    return 'priceMin must be less than or equal to priceMax.';
  }

  return null;
};


const validateManualVerificationRequest = (body: ManualVerificationRequestBody | undefined): string | null => {
  if (!body || typeof body !== 'object') {
    return 'Request body is required.';
  }

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return 'reason is required.';
  }

  if (body.screenshotPath !== undefined && typeof body.screenshotPath !== 'string') {
    return 'screenshotPath must be a string when provided.';
  }

  if (body.resumeContext !== undefined && !isManualVerificationContext(body.resumeContext)) {
    return 'resumeContext must be an object when provided.';
  }

  body.reason = body.reason.trim();
  body.screenshotPath = body.screenshotPath?.trim();
  body.resumeContext = body.resumeContext as ManualVerificationContext | undefined;
  return null;
};

const validateManualVerificationResume = (body: ManualVerificationResumeBody | undefined): string | null => {
  if (body?.resumeContext !== undefined && !isManualVerificationContext(body.resumeContext)) {
    return 'resumeContext must be an object when provided.';
  }

  if (body) {
    body.resumeContext = body.resumeContext as ManualVerificationContext | undefined;
  }
  return null;
};

const isManualVerificationContext = (value: unknown): value is ManualVerificationContext =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

const sendTaskError = (reply: FastifyReply, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown task error.';

  if (message.startsWith('Task not found')) {
    return reply.code(404).send(apiError('TASK_NOT_FOUND', message));
  }

  if (message.startsWith('Platform task not found')) {
    return reply.code(404).send(apiError('PLATFORM_TASK_NOT_FOUND', message));
  }

  if (message.startsWith('Manual verification not found')) {
    return reply.code(404).send(apiError('MANUAL_VERIFICATION_NOT_FOUND', message));
  }

  if (message.startsWith('Illegal')) {
    return reply.code(409).send(apiError('ILLEGAL_STATE_TRANSITION', message));
  }

  return reply.code(500).send(apiError('TASK_OPERATION_FAILED', message));
};
