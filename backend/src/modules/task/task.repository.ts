import type { Task } from './task.types.js';

export class TaskRepository {
  save(_task: Task): Promise<void> {
    throw new Error('TaskRepository.save is not implemented in stage 4.');
  }

  findById(_taskId: string): Promise<Task | null> {
    throw new Error('TaskRepository.findById is not implemented in stage 4.');
  }
}
