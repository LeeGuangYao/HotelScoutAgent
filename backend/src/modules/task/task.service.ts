import { randomUUID } from 'node:crypto';
import { createBrowserAgent, type BrowserAgent, type BrowserSessionSnapshot } from '../browser/index.js';
import { TaskScheduler } from '../scheduler/task-scheduler.js';
import { TaskStateMachine } from '../state-machine/task-state-machine.js';
import { TaskRepository } from './task.repository.js';
import type {
  ManualVerificationRecord,
  PlatformCode,
  PlatformTask,
  PlatformTaskStatus,
  RequestManualVerificationInput,
  ResumeManualVerificationInput,
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
      manualVerifications: await this.repository.findManualVerificationsByTaskId(taskId),
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
    options: { currentStep?: string; issue?: string; collectedCount?: number; manualVerificationId?: string } = {},
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
      manualVerificationId: options.manualVerificationId ?? platformTask.manualVerificationId,
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

  async requestManualVerification(input: RequestManualVerificationInput): Promise<TaskDetail> {
    const task = await this.ensureTaskExists(input.taskId);
    const platformTask = await this.ensurePlatformTask(input.taskId, input.platform);
    const now = new Date().toISOString();
    const browserRequest = await this.requestBrowserManualVerification(input);
    const screenshotPath = input.screenshotPath ?? browserRequest?.screenshotPath;

    const manualVerification: ManualVerificationRecord = {
      id: randomUUID(),
      taskId: input.taskId,
      platform: input.platform,
      reason: input.reason,
      status: 'waiting',
      previousTaskStatus: task.status,
      previousPlatformStatus: platformTask.status,
      resumeToTaskStatus: 'running',
      resumeToPlatformStatus: platformTask.status === 'waiting_manual_verification' ? 'opening' : platformTask.status,
      screenshotPath,
      resumeContext: input.resumeContext,
      requestedAt: browserRequest?.requestedAt ?? now,
    };

    await this.repository.saveManualVerification(manualVerification);
    await this.transitionPlatformTask(input.taskId, input.platform, 'waiting_manual_verification', {
      currentStep: '等待人工处理登录、验证码或滑块验证',
      issue: input.reason,
      manualVerificationId: manualVerification.id,
    });
    await this.transitionTask(input.taskId, 'waiting_manual_verification');

    return this.requireTaskDetail(input.taskId);
  }

  async resumeManualVerification(input: ResumeManualVerificationInput): Promise<TaskDetail> {
    const manualVerification = await this.repository.findActiveManualVerification(input.taskId, input.platform);
    if (!manualVerification) {
      throw new Error(`Manual verification not found: ${input.taskId}/${input.platform}`);
    }

    const browserSession = this.browserAgent.getSession(input.platform);
    if (browserSession?.taskId === input.taskId && browserSession.status === 'waiting_manual_verification') {
      this.browserAgent.resumeManualVerification(input.platform);
    }

    const resumed: ManualVerificationRecord = {
      ...manualVerification,
      status: 'resumed',
      resumeContext: input.resumeContext ?? manualVerification.resumeContext,
      resumedAt: new Date().toISOString(),
    };
    await this.repository.saveManualVerification(resumed);

    await this.transitionPlatformTask(input.taskId, input.platform, manualVerification.resumeToPlatformStatus, {
      currentStep: '人工验证已完成，等待继续调度',
      issue: '',
      manualVerificationId: manualVerification.id,
    });
    await this.transitionTask(input.taskId, manualVerification.resumeToTaskStatus);

    return this.requireTaskDetail(input.taskId);
  }

  listBrowserSessions(): BrowserSessionSnapshot[] {
    return this.browserAgent.listSessions();
  }

  getSchedulerSnapshot(): ReturnType<TaskScheduler['snapshot']> {
    return this.scheduler.snapshot();
  }

  private async requestBrowserManualVerification(
    input: RequestManualVerificationInput,
  ): Promise<Awaited<ReturnType<BrowserAgent['requestManualVerification']>> | null> {
    const browserSession = this.browserAgent.getSession(input.platform);
    if (!browserSession || browserSession.taskId !== input.taskId) {
      return null;
    }

    return this.browserAgent.requestManualVerification({
      taskId: input.taskId,
      platform: input.platform,
      reason: input.reason,
      screenshotPath: input.screenshotPath,
    });
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

  private async ensurePlatformTask(taskId: string, platform: PlatformCode): Promise<PlatformTask> {
    const platformTask = await this.repository.findPlatformTask(taskId, platform);
    if (!platformTask) {
      throw new Error(`Platform task not found: ${taskId}/${platform}`);
    }
    return platformTask;
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
