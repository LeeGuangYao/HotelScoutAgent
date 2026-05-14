import type { SearchCriteria, Task } from './task.types.js';

export class TaskService {
  createTask(_criteria: SearchCriteria): Promise<Task> {
    throw new Error('TaskService.createTask is not implemented in stage 4.');
  }

  getTask(_taskId: string): Promise<Task | null> {
    throw new Error('TaskService.getTask is not implemented in stage 4.');
  }
}
