import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  createBrowserAgent,
  type BrowserAgent,
  type BrowserSessionSnapshot,
} from "../browser/index.js";
import { TaskScheduler } from "../scheduler/task-scheduler.js";
import { TaskStateMachine } from "../state-machine/task-state-machine.js";
import { TaskRepository } from "./task.repository.js";
import type {
  HotelResult,
  ManualVerificationRecord,
  Money,
  PlatformCode,
  PlatformTask,
  PlatformTaskStatus,
  TaskEvent,
  TaskEventListener,
  TaskEventResultsSummary,
  TaskEventSnapshot,
  RequestManualVerificationInput,
  ResumeManualVerificationInput,
  SearchCriteria,
  Task,
  TaskDetail,
  TaskResults,
  TaskStatus,
} from "./task.types.js";

const DEFAULT_SORT_BY: SearchCriteria["sortBy"] = "price";
const DEFAULT_PLATFORMS: readonly PlatformCode[] = ["ctrip"];

const PLATFORM_PRICE_OFFSETS: Record<PlatformCode, number> = {
  ctrip: 0,
  booking: 28,
  fliggy: 16,
  meituan: 42,
};

const PLATFORM_SOURCE_HOSTS: Record<PlatformCode, string> = {
  ctrip: "https://hotels.ctrip.com",
  booking: "https://www.booking.com",
  fliggy: "https://www.fliggy.com",
  meituan: "https://hotel.meituan.com",
};

export class TaskService {
  private readonly repository: TaskRepository;
  private readonly stateMachine: TaskStateMachine;
  private readonly scheduler: TaskScheduler;
  private readonly events = new EventEmitter();

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
      status: "created",
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(task);

    const seededResults = this.createMvpResults(task, now);

    await Promise.all(
      normalizedCriteria.platforms.map((platform) =>
        this.repository.savePlatformTask({
          id: `${task.id}:${platform}`,
          taskId: task.id,
          platform,
          status: "pending",
          currentStep: "等待调度，已准备结果展示 MVP 示例数据",
          collectedCount: seededResults.filter(
            (result) => result.platform === platform,
          ).length,
          updatedAt: now,
        }),
      ),
    );
    await this.repository.saveHotelResults(seededResults);
    await this.publishResultsCountChanged(task.id);

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
      manualVerifications:
        await this.repository.findManualVerificationsByTaskId(taskId),
    };
  }

  async getTaskEventSnapshot(
    taskId: string,
  ): Promise<TaskEventSnapshot | null> {
    const detail = await this.getTaskDetail(taskId);
    if (!detail) {
      return null;
    }

    return {
      detail,
      resultsSummary: await this.getTaskEventResultsSummary(taskId),
    };
  }

  subscribeTaskEvents(taskId: string, listener: TaskEventListener): () => void {
    const eventName = this.taskEventName(taskId);
    this.events.on(eventName, listener);
    return () => {
      this.events.off(eventName, listener);
    };
  }

  async getTaskResults(taskId: string): Promise<TaskResults | null> {
    const task = await this.repository.findById(taskId);
    if (!task) {
      return null;
    }

    const results = this.markLowestDetailPrices(
      await this.repository.findHotelResultsByTaskId(taskId),
    );
    const lowestDetailPrice = results.find(
      (result) => result.isLowestDetailPrice,
    )?.detailPrice;

    return {
      task,
      summary: {
        totalResults: results.length,
        detailPriceCount: results.filter((result) => result.detailPrice).length,
        lowestDetailPrice,
        platformCount: new Set(results.map((result) => result.platform)).size,
        evidenceCompleteCount: results.filter(
          (result) => result.screenshotPath && result.sourceUrl,
        ).length,
        generatedAt: new Date().toISOString(),
      },
      results,
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
      completedAt: this.isCompletedStatus(status)
        ? new Date().toISOString()
        : task.completedAt,
    };

    await this.repository.save(updated);
    this.publishTaskEvent({
      id: randomUUID(),
      taskId,
      type: "task_status_changed",
      occurredAt: updated.updatedAt,
      payload: { task: updated },
    });
    return updated;
  }

  async transitionPlatformTask(
    taskId: string,
    platform: PlatformCode,
    status: PlatformTaskStatus,
    options: {
      currentStep?: string;
      issue?: string;
      collectedCount?: number;
      manualVerificationId?: string;
    } = {},
  ): Promise<PlatformTask> {
    const platformTask = await this.repository.findPlatformTask(
      taskId,
      platform,
    );
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
      manualVerificationId:
        options.manualVerificationId ?? platformTask.manualVerificationId,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.savePlatformTask(updated);
    this.publishTaskEvent({
      id: randomUUID(),
      taskId,
      type: "platform_status_changed",
      occurredAt: updated.updatedAt,
      payload: {
        platformTask: updated,
        resultsSummary: await this.getTaskEventResultsSummary(taskId),
      },
    });
    return updated;
  }

  openBrowserSession(
    taskId: string,
    platform: PlatformCode,
  ): Promise<BrowserSessionSnapshot> {
    return this.browserAgent.openSession({ taskId, platform });
  }

  closeBrowserSession(platform: PlatformCode): Promise<void> {
    return this.browserAgent.closeSession(platform);
  }

  async requestManualVerification(
    input: RequestManualVerificationInput,
  ): Promise<TaskDetail> {
    const task = await this.ensureTaskExists(input.taskId);
    const platformTask = await this.ensurePlatformTask(
      input.taskId,
      input.platform,
    );
    const now = new Date().toISOString();
    const browserRequest = await this.requestBrowserManualVerification(input);
    const screenshotPath =
      input.screenshotPath ?? browserRequest?.screenshotPath;

    const manualVerification: ManualVerificationRecord = {
      id: randomUUID(),
      taskId: input.taskId,
      platform: input.platform,
      reason: input.reason,
      status: "waiting",
      previousTaskStatus: task.status,
      previousPlatformStatus: platformTask.status,
      resumeToTaskStatus: "running",
      resumeToPlatformStatus:
        platformTask.status === "waiting_manual_verification"
          ? "opening"
          : platformTask.status,
      screenshotPath,
      resumeContext: input.resumeContext,
      requestedAt: browserRequest?.requestedAt ?? now,
    };

    await this.repository.saveManualVerification(manualVerification);
    this.publishTaskEvent({
      id: randomUUID(),
      taskId: input.taskId,
      type: "manual_verification_requested",
      occurredAt: manualVerification.requestedAt,
      payload: { manualVerification },
    });
    await this.transitionPlatformTask(
      input.taskId,
      input.platform,
      "waiting_manual_verification",
      {
        currentStep: "等待人工处理登录、验证码或滑块验证",
        issue: input.reason,
        manualVerificationId: manualVerification.id,
      },
    );
    await this.transitionTask(input.taskId, "waiting_manual_verification");

    return this.requireTaskDetail(input.taskId);
  }

  async resumeManualVerification(
    input: ResumeManualVerificationInput,
  ): Promise<TaskDetail> {
    const manualVerification =
      await this.repository.findActiveManualVerification(
        input.taskId,
        input.platform,
      );
    if (!manualVerification) {
      throw new Error(
        `Manual verification not found: ${input.taskId}/${input.platform}`,
      );
    }

    const browserSession = this.browserAgent.getSession(input.platform);
    if (
      browserSession?.taskId === input.taskId &&
      browserSession.status === "waiting_manual_verification"
    ) {
      this.browserAgent.resumeManualVerification(input.platform);
    }

    const resumedAt = new Date().toISOString();
    const resumed: ManualVerificationRecord = {
      ...manualVerification,
      status: "resumed",
      resumeContext: input.resumeContext ?? manualVerification.resumeContext,
      resumedAt,
    };
    await this.repository.saveManualVerification(resumed);
    this.publishTaskEvent({
      id: randomUUID(),
      taskId: input.taskId,
      type: "manual_verification_resumed",
      occurredAt: resumedAt,
      payload: { manualVerification: resumed },
    });

    await this.transitionPlatformTask(
      input.taskId,
      input.platform,
      manualVerification.resumeToPlatformStatus,
      {
        currentStep: "人工验证已完成，等待继续调度",
        issue: "",
        manualVerificationId: manualVerification.id,
      },
    );
    await this.transitionTask(
      input.taskId,
      manualVerification.resumeToTaskStatus,
    );

    return this.requireTaskDetail(input.taskId);
  }

  listBrowserSessions(): BrowserSessionSnapshot[] {
    return this.browserAgent.listSessions();
  }

  getSchedulerSnapshot(): ReturnType<TaskScheduler["snapshot"]> {
    return this.scheduler.snapshot();
  }

  private async publishResultsCountChanged(taskId: string): Promise<void> {
    this.publishTaskEvent({
      id: randomUUID(),
      taskId,
      type: "results_count_changed",
      occurredAt: new Date().toISOString(),
      payload: {
        resultsSummary: await this.getTaskEventResultsSummary(taskId),
      },
    });
  }

  private async getTaskEventResultsSummary(
    taskId: string,
  ): Promise<TaskEventResultsSummary> {
    const results = await this.repository.findHotelResultsByTaskId(taskId);
    return {
      totalResults: results.length,
      detailPriceCount: results.filter((result) => result.detailPrice).length,
      platformCount: new Set(results.map((result) => result.platform)).size,
      evidenceCompleteCount: results.filter(
        (result) => result.screenshotPath && result.sourceUrl,
      ).length,
      generatedAt: new Date().toISOString(),
    };
  }

  private publishTaskEvent(event: TaskEvent): void {
    this.events.emit(this.taskEventName(event.taskId), event);
  }

  private taskEventName(taskId: string): string {
    return `task:${taskId}`;
  }

  private async requestBrowserManualVerification(
    input: RequestManualVerificationInput,
  ): Promise<Awaited<
    ReturnType<BrowserAgent["requestManualVerification"]>
  > | null> {
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

  private createMvpResults(task: Task, collectedAt: string): HotelResult[] {
    const destination = task.criteria.destination;
    const keyword = task.criteria.keywords?.[0] ?? "市中心";
    const baseMaxPrice =
      task.criteria.priceMax && task.criteria.priceMax > 0
        ? task.criteria.priceMax
        : 520;
    const firstBasePrice = Math.max(
      task.criteria.priceMin ?? 0,
      Math.min(baseMaxPrice - 34, 486),
    );

    return task.criteria.platforms.flatMap((platform, platformIndex) => {
      const offset = PLATFORM_PRICE_OFFSETS[platform];
      const primaryDetailAmount = firstBasePrice + offset;
      const primaryListAmount =
        primaryDetailAmount - (platformIndex % 2 === 0 ? 0 : 18);
      const fallbackListAmount = firstBasePrice + offset + 96;

      return [
        {
          id: `${task.id}:${platform}:primary`,
          taskId: task.id,
          hotelName: `${destination}${keyword}精选酒店`,
          location: `${destination} · ${keyword}`,
          platform,
          listPrice: this.money(primaryListAmount),
          detailPrice: this.money(primaryDetailAmount),
          isLowestDetailPrice: false,
          trustLevel: "high",
          trustReasons: [
            "已保存详情页截图",
            "包含来源 URL 与采集时间",
            primaryListAmount === primaryDetailAmount
              ? "列表价与详情确认价一致"
              : "列表价与详情确认价不一致",
          ],
          screenshotPath: `screenshots/${task.id}/${platform}-primary.png`,
          sourceUrl: `${PLATFORM_SOURCE_HOSTS[platform]}/hotel/${encodeURIComponent(destination)}-${platform}-primary`,
          collectedAt,
        },
        {
          id: `${task.id}:${platform}:secondary`,
          taskId: task.id,
          hotelName: `${destination}近地铁舒适酒店`,
          location: `${destination} · 近地铁`,
          platform,
          listPrice: this.money(fallbackListAmount),
          detailPrice:
            platformIndex === 0
              ? undefined
              : this.money(fallbackListAmount + 22),
          isLowestDetailPrice: false,
          trustLevel: platformIndex === 0 ? "low" : "medium",
          trustReasons:
            platformIndex === 0
              ? ["缺少详情页确认价", "截图证据缺失，仅保留列表页价格"]
              : ["有详情页确认价和来源 URL", "截图证据缺失，可信度降低"],
          sourceUrl: `${PLATFORM_SOURCE_HOSTS[platform]}/hotel/${encodeURIComponent(destination)}-${platform}-secondary`,
          collectedAt,
        },
      ];
    });
  }

  private markLowestDetailPrices(results: HotelResult[]): HotelResult[] {
    const detailPrices = results
      .map((result) => result.detailPrice?.amount)
      .filter((amount): amount is number => typeof amount === "number");
    const lowestAmount =
      detailPrices.length > 0 ? Math.min(...detailPrices) : null;

    return results.map((result) => ({
      ...result,
      isLowestDetailPrice:
        lowestAmount !== null && result.detailPrice?.amount === lowestAmount,
    }));
  }

  private money(amount: number): Money {
    return {
      amount,
      currency: "CNY",
      display: `¥${amount}`,
    };
  }

  private normalizeCriteria(criteria: SearchCriteria): SearchCriteria {
    return {
      ...criteria,
      destination: criteria.destination.trim(),
      keywords: criteria.keywords
        ?.map((keyword) => keyword.trim())
        .filter(Boolean),
      platforms:
        criteria.platforms.length > 0
          ? criteria.platforms
          : [...DEFAULT_PLATFORMS],
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

  private async ensurePlatformTask(
    taskId: string,
    platform: PlatformCode,
  ): Promise<PlatformTask> {
    const platformTask = await this.repository.findPlatformTask(
      taskId,
      platform,
    );
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
    return (
      status === "completed" || status === "failed" || status === "cancelled"
    );
  }
}
