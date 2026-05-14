import { createBrowserAgent, type BrowserAgent, type BrowserSessionSnapshot } from '../browser/index.js';
import type { PlatformCode, SearchCriteria, Task } from './task.types.js';

export class TaskService {
  constructor(private readonly browserAgent: BrowserAgent = createBrowserAgent()) {}

  createTask(_criteria: SearchCriteria): Promise<Task> {
    throw new Error('TaskService.createTask is not implemented in stage 5.');
  }

  getTask(_taskId: string): Promise<Task | null> {
    throw new Error('TaskService.getTask is not implemented in stage 5.');
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
}
