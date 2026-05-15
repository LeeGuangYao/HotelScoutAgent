import type { PlatformTaskStatus, TaskStatus } from '../task/task.types.js';

const TASK_TERMINAL_STATUSES = new Set<TaskStatus>(['completed', 'failed', 'cancelled']);
const PLATFORM_TERMINAL_STATUSES = new Set<PlatformTaskStatus>(['completed', 'failed', 'skipped']);

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  created: ['running', 'waiting_manual_verification', 'cancelled', 'failed'],
  running: ['waiting_manual_verification', 'paused', 'completed', 'cancelled', 'failed'],
  waiting_manual_verification: ['running', 'cancelled', 'failed'],
  paused: ['running', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};

const PLATFORM_HAPPY_PATH: readonly PlatformTaskStatus[] = [
  'pending',
  'opening',
  'searching',
  'collecting_list',
  'confirming_detail',
  'saving_evidence',
  'completed',
];

export class TaskStateMachine {
  canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
    if (from === to) {
      return true;
    }

    if (TASK_TERMINAL_STATUSES.has(from)) {
      return false;
    }

    return TASK_TRANSITIONS[from].includes(to);
  }

  assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
    if (!this.canTransitionTask(from, to)) {
      throw new Error(`Illegal task status transition: ${from} -> ${to}`);
    }
  }

  canTransitionPlatform(from: PlatformTaskStatus, to: PlatformTaskStatus): boolean {
    if (from === to) {
      return true;
    }

    if (PLATFORM_TERMINAL_STATUSES.has(from)) {
      return false;
    }

    if (to === 'waiting_manual_verification' || to === 'skipped' || to === 'failed') {
      return true;
    }

    if (from === 'waiting_manual_verification') {
      return !PLATFORM_TERMINAL_STATUSES.has(to);
    }

    const fromIndex = PLATFORM_HAPPY_PATH.indexOf(from);
    const toIndex = PLATFORM_HAPPY_PATH.indexOf(to);
    return fromIndex >= 0 && toIndex === fromIndex + 1;
  }

  assertPlatformTransition(from: PlatformTaskStatus, to: PlatformTaskStatus): void {
    if (!this.canTransitionPlatform(from, to)) {
      throw new Error(`Illegal platform status transition: ${from} -> ${to}`);
    }
  }

  isTaskTerminal(status: TaskStatus): boolean {
    return TASK_TERMINAL_STATUSES.has(status);
  }

  isPlatformTerminal(status: PlatformTaskStatus): boolean {
    return PLATFORM_TERMINAL_STATUSES.has(status);
  }
}
