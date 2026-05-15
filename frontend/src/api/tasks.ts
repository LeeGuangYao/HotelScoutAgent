import type { ManualVerificationContext, PlatformCode, SearchCriteria, TaskDetail } from '@/types/task';

type ApiEnvelope<TData> = {
  data: TData;
};

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

const parseResponse = async <TData>(response: Response): Promise<TData> => {
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<TData> & ApiErrorEnvelope;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `请求失败：HTTP ${response.status}`);
  }

  return payload.data;
};

export const createTask = async (criteria: SearchCriteria): Promise<TaskDetail> => {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });
  return parseResponse<TaskDetail>(response);
};

export const getTaskDetail = async (taskId: string): Promise<TaskDetail> => {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
  return parseResponse<TaskDetail>(response);
};

export const pauseTask = async (taskId: string): Promise<TaskDetail> => {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/pause`, { method: 'POST' });
  return parseResponse<TaskDetail>(response);
};

export const resumeTask = async (taskId: string): Promise<TaskDetail> => {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/resume`, { method: 'POST' });
  return parseResponse<TaskDetail>(response);
};

export const skipPlatform = async (taskId: string, platform: PlatformCode): Promise<void> => {
  const response = await fetch(
    `/api/tasks/${encodeURIComponent(taskId)}/platforms/${encodeURIComponent(platform)}/skip`,
    { method: 'POST' },
  );
  await parseResponse<unknown>(response);
};

export const resumeManualVerification = async (
  taskId: string,
  platform: PlatformCode,
  resumeContext: ManualVerificationContext = { source: 'frontend-task-page' },
): Promise<TaskDetail> => {
  const response = await fetch(
    `/api/tasks/${encodeURIComponent(taskId)}/platforms/${encodeURIComponent(platform)}/manual-verification/resume`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeContext }),
    },
  );
  return parseResponse<TaskDetail>(response);
};
