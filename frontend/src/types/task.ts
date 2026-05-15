export type PlatformCode = 'ctrip' | 'booking' | 'fliggy' | 'meituan';

export type SortBy = 'price' | 'trust' | 'distance';

export type SearchCriteria = {
  destination: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  keywords?: string[];
  priceMin?: number;
  priceMax?: number;
  distanceFilter?: string;
  platforms: PlatformCode[];
  sortBy: SortBy;
};

export type TaskStatus =
  | 'created'
  | 'running'
  | 'waiting_manual_verification'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PlatformTaskStatus =
  | 'pending'
  | 'opening'
  | 'searching'
  | 'collecting_list'
  | 'confirming_detail'
  | 'saving_evidence'
  | 'waiting_manual_verification'
  | 'skipped'
  | 'completed'
  | 'failed';

export type ManualVerificationStatus = 'waiting' | 'resumed';

export type ManualVerificationContext = Record<string, unknown>;

export type ManualVerificationRecord = {
  id: string;
  taskId: string;
  platform: PlatformCode;
  reason: string;
  status: ManualVerificationStatus;
  previousTaskStatus: TaskStatus;
  previousPlatformStatus: PlatformTaskStatus;
  resumeToTaskStatus: TaskStatus;
  resumeToPlatformStatus: PlatformTaskStatus;
  screenshotPath?: string;
  resumeContext?: ManualVerificationContext;
  requestedAt: string;
  resumedAt?: string;
};

export type Task = {
  id: string;
  name: string;
  criteria: SearchCriteria;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type PlatformTask = {
  id: string;
  taskId: string;
  platform: PlatformCode;
  status: PlatformTaskStatus;
  currentStep: string;
  collectedCount: number;
  issue?: string;
  manualVerificationId?: string;
  updatedAt: string;
};

export type TaskDetail = {
  task: Task;
  platforms: PlatformTask[];
  manualVerifications: ManualVerificationRecord[];
};
