import type { PlatformTask, Task } from './task.types.js';

const cloneTask = (task: Task): Task => ({
  ...task,
  criteria: {
    ...task.criteria,
    keywords: task.criteria.keywords ? [...task.criteria.keywords] : undefined,
    platforms: [...task.criteria.platforms],
  },
});

const clonePlatformTask = (platformTask: PlatformTask): PlatformTask => ({ ...platformTask });

export class TaskRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly platformTasks = new Map<string, PlatformTask>();

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
}
