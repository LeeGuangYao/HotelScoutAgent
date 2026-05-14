export class TaskScheduler {
  enqueue(_taskId: string): Promise<void> {
    throw new Error('TaskScheduler.enqueue is not implemented in stage 4.');
  }

  stop(_taskId: string): Promise<void> {
    throw new Error('TaskScheduler.stop is not implemented in stage 4.');
  }
}
