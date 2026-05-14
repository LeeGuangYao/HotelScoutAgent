import type { PlatformTaskStatus, TaskStatus } from '../task/task.types.js';

export type TaskStateTransition = {
  from: TaskStatus;
  to: TaskStatus;
  reason: string;
};

export type PlatformStateTransition = {
  from: PlatformTaskStatus;
  to: PlatformTaskStatus;
  reason: string;
};
