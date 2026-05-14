import { randomUUID } from 'node:crypto';
import { createBrowserAgent, type BrowserAgent, type BrowserSessionSnapshot } from '../browser/index.js';
import { TaskScheduler } from '../scheduler/task-scheduler.js';
import { TaskStateMachine } from '../state-machine/task-state-machine.js';
import { TaskRepository } from './task.repository.js';
import type {
  PlatformCode,
  PlatformTask,
  PlatformTaskStatus,
  SearchCriteria,
  Task,
  TaskDetail,
  TaskStatus,
} from './task.types.js';

const DEFAULT_SORT_BY: SearchCriteria['sortBy'] = 'price';
const DEFAULT_PLATFORMS: readonly PlatformCode[] = ['ctrip'];

export class TaskService {
  private readonly repository: TaskRepository;
  private readonly stateMachine: TaskStateMachine;
  private readonly scheduler: TaskScheduler;

  constructor(
    private readonly browserAgent: BrowserAgent = createBrowserAgent(),
    dependencies: {
      repository?: TaskRepository;
      stateMachine?: TaskStateMachine;
      scheduler?: TaskScheduler;
    } = {},
  ) {
    this.repository = dependencies.repository ?? new TaskRepository();
    this.stateMachine = dependencies.stateMachine ?? new TaskStateMachine();
    this.scheduler =
      dependencies.scheduler ??
      new TaskScheduler({
        onStatusChange: async (taskId, status) => {
          await this.transitionTask(taskId, status);
        },
      });
  }

  async createTask(criteria: SearchCriteria): Promise<Task> {
    const normalizedCriteria = this.normalizeCriteria(criteria);
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      name: `${normalizedCriteria.destination}酒店比价`,
      criteria: normalizedCriteria,
      status: 'created',
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(task);

    await Promise.all(
      normalizedCriteria.platforms.map((platform) =>
        this.repository.savePlatformTask({
          id: `${task.id}:${platform}`,
          taskId: task.id,
          platform,
          status: 'pending',
          currentStep: '等待调度',
          collectedCount: 0,
          updatedAt: now,
        }),
      ),
    );

    return task;
  }

  getTask(taskId: string): Promise<Task | null> {
    return this.repository.findById(taskId);
  }

  async getTaskDetail(taskId: string): Promise<TaskDetail | null> {
    const task = await this.repository.findById(taskId);
    if (!task) {
      return null;
    }

    return {
      task,
      platforms: await this.repository.findPlatformTasksByTaskId(taskId),
    };
  }

  async enqueueTask(taskId: string): Promise<TaskDetail> {
    await this.ensureTaskExists(taskId);
    await this.scheduler.enqueue(taskId);
    return this.requireTaskDetail(taskId);
  }

  async stopTask(taskId: string): Promise<TaskDetail> {
    await this.ensureTaskExists(taskId);
    await this.scheduler.stop(taskId);
    return this.requireTaskDetail(taskId);
  }

  async transitionTask(taskId: string, status: TaskStatus): Promise<Task> {
    const task = await this.ensureTaskExists(taskId);
    this.stateMachine.assertTaskTransition(task.status, status);

    const updated: Task = {
      ...task,
      status,
      updatedAt: new Date().toISOString(),
      completedAt: this.isCompletedStatus(status) ? new Date().toISOString() : task.completedAt,
    };

    await this.repository.save(updated);
    return updated;
  }

  async transitionPlatformTask(
    taskId: string,
    platform: PlatformCode,
    status: PlatformTaskStatus,
    options: { currentStep?: string; issue?: string; collectedCount?: number } = {},
  ): Promise<PlatformTask> {
    const platformTask = await this.repository.findPlatformTask(taskId, platform);
    if (!platformTask) {
      throw new Error(`Platform task not found: ${taskId}/${platform}`);
    }

    this.stateMachine.assertPlatformTransition(platformTask.status, status);

    const updated: PlatformTask = {
      ...platformTask,
      status,
      currentStep: options.currentStep ?? platformTask.currentStep,
      collectedCount: options.collectedCount ?? platformTask.collectedCount,
      issue: options.issue ?? platformTask.issue,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.savePlatformTask(updated);
    return updated;
  }

  openBrowserSession(taskId: string, platform: PlatformCode): Promise<BrowserSessionSnapshot> {
    return this.browserAgent.openSession({ taskId, platform });
  }

  closeBrowserSession(platform: PlatformCode): Promise<void> {
    return this.browserAgent.closeSession(platform);
  }

  requestManualVerification(
    taskId: string,
    platform: PlatformCode,
    reason: string,
  ): ReturnType<BrowserAgent['requestManualVerification']> {
    return this.browserAgent.requestManualVerification({ taskId, platform, reason });
  }

  resumeManualVerification(platform: PlatformCode): BrowserSessionSnapshot {
    return this.browserAgent.resumeManualVerification(platform);
  }

  listBrowserSessions(): BrowserSessionSnapshot[] {
    return this.browserAgent.listSessions();
  }

  getSchedulerSnapshot(): ReturnType<TaskScheduler['snapshot']> {
    return this.scheduler.snapshot();
  }

  private normalizeCriteria(criteria: SearchCriteria): SearchCriteria {
    return {
      ...criteria,
      destination: criteria.destination.trim(),
      keywords: criteria.keywords?.map((keyword) => keyword.trim()).filter(Boolean),
      platforms: criteria.platforms.length > 0 ? criteria.platforms : [...DEFAULT_PLATFORMS],
      sortBy: criteria.sortBy ?? DEFAULT_SORT_BY,
    };
  }

  private async ensureTaskExists(taskId: string): Promise<Task> {
    const task = await this.repository.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }

  private async requireTaskDetail(taskId: string): Promise<TaskDetail> {
    const detail = await this.getTaskDetail(taskId);
    if (!detail) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return detail;
  }

  private isCompletedStatus(status: TaskStatus): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
  }
}
