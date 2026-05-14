import type { TaskStatus } from '../task/task.types.js';

export type TaskSchedulerSnapshot = {
  queuedTaskIds: string[];
  stoppedTaskIds: string[];
};

export type TaskSchedulerHooks = {
  onStatusChange?: (taskId: string, status: TaskStatus) => Promise<void>;
};

export class TaskScheduler {
  private readonly queuedTaskIds = new Set<string>();
  private readonly stoppedTaskIds = new Set<string>();

  constructor(private readonly hooks: TaskSchedulerHooks = {}) {}

  async enqueue(taskId: string): Promise<void> {
    this.stoppedTaskIds.delete(taskId);
    this.queuedTaskIds.add(taskId);
    await this.hooks.onStatusChange?.(taskId, 'running');
  }

  async stop(taskId: string): Promise<void> {
    this.queuedTaskIds.delete(taskId);
    this.stoppedTaskIds.add(taskId);
    await this.hooks.onStatusChange?.(taskId, 'paused');
  }

  snapshot(): TaskSchedulerSnapshot {
    return {
      queuedTaskIds: [...this.queuedTaskIds],
      stoppedTaskIds: [...this.stoppedTaskIds],
    };
  }
}
