import type { HotelResult, ManualVerificationRecord, PlatformTask, Task } from './task.types.js';

const cloneTask = (task: Task): Task => ({
  ...task,
  criteria: {
    ...task.criteria,
    keywords: task.criteria.keywords ? [...task.criteria.keywords] : undefined,
    platforms: [...task.criteria.platforms],
  },
});

const clonePlatformTask = (platformTask: PlatformTask): PlatformTask => ({ ...platformTask });

const cloneManualVerification = (record: ManualVerificationRecord): ManualVerificationRecord => ({
  ...record,
  resumeContext: record.resumeContext ? { ...record.resumeContext } : undefined,
});

const cloneHotelResult = (result: HotelResult): HotelResult => ({
  ...result,
  listPrice: result.listPrice ? { ...result.listPrice } : undefined,
  detailPrice: result.detailPrice ? { ...result.detailPrice } : undefined,
  trustReasons: [...result.trustReasons],
});

export class TaskRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly platformTasks = new Map<string, PlatformTask>();
  private readonly manualVerifications = new Map<string, ManualVerificationRecord>();
  private readonly hotelResults = new Map<string, HotelResult>();

  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, cloneTask(task));
  }

  async findById(taskId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    return task ? cloneTask(task) : null;
  }

  async savePlatformTask(platformTask: PlatformTask): Promise<void> {
    this.platformTasks.set(platformTask.id, clonePlatformTask(platformTask));
  }

  async findPlatformTasksByTaskId(taskId: string): Promise<PlatformTask[]> {
    return [...this.platformTasks.values()]
      .filter((platformTask) => platformTask.taskId === taskId)
      .map(clonePlatformTask)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async findPlatformTask(taskId: string, platform: PlatformTask['platform']): Promise<PlatformTask | null> {
    const platformTask = [...this.platformTasks.values()].find(
      (candidate) => candidate.taskId === taskId && candidate.platform === platform,
    );
    return platformTask ? clonePlatformTask(platformTask) : null;
  }

  async saveManualVerification(record: ManualVerificationRecord): Promise<void> {
    this.manualVerifications.set(record.id, cloneManualVerification(record));
  }

  async findManualVerificationsByTaskId(taskId: string): Promise<ManualVerificationRecord[]> {
    return [...this.manualVerifications.values()]
      .filter((record) => record.taskId === taskId)
      .map(cloneManualVerification)
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
  }

  async findActiveManualVerification(
    taskId: string,
    platform: PlatformTask['platform'],
  ): Promise<ManualVerificationRecord | null> {
    const records = await this.findManualVerificationsByTaskId(taskId);
    const activeRecord = records
      .filter((record) => record.platform === platform && record.status === 'waiting')
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))[0];

    return activeRecord ? cloneManualVerification(activeRecord) : null;
  }

  async saveHotelResults(results: HotelResult[]): Promise<void> {
    for (const result of results) {
      this.hotelResults.set(result.id, cloneHotelResult(result));
    }
  }

  async findHotelResultsByTaskId(taskId: string): Promise<HotelResult[]> {
    return [...this.hotelResults.values()]
      .filter((result) => result.taskId === taskId)
      .map(cloneHotelResult)
      .sort((left, right) => left.collectedAt.localeCompare(right.collectedAt) || left.id.localeCompare(right.id));
  }
}
