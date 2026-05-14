import type { PlatformTaskStatus, TaskStatus } from '../task/task.types.js';

export class TaskStateMachine {
  canTransitionTask(_from: TaskStatus, _to: TaskStatus): boolean {
    throw new Error('TaskStateMachine.canTransitionTask is not implemented in stage 4.');
  }

  canTransitionPlatform(_from: PlatformTaskStatus, _to: PlatformTaskStatus): boolean {
    throw new Error('TaskStateMachine.canTransitionPlatform is not implemented in stage 4.');
  }
}
