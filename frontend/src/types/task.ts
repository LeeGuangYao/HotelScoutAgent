export type PlatformCode = "ctrip" | "booking" | "fliggy" | "meituan";

export type SortBy = "price" | "trust" | "distance";

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
  | "created"
  | "running"
  | "waiting_manual_verification"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type PlatformTaskStatus =
  | "pending"
  | "opening"
  | "searching"
  | "collecting_list"
  | "confirming_detail"
  | "saving_evidence"
  | "waiting_manual_verification"
  | "skipped"
  | "completed"
  | "failed";

export type ManualVerificationStatus = "waiting" | "resumed";

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

export type RequestManualVerificationInput = {
  taskId: string;
  platform: PlatformCode;
  reason: string;
  screenshotPath?: string;
  resumeContext?: ManualVerificationContext;
};

export type ResumeManualVerificationInput = {
  taskId: string;
  platform: PlatformCode;
  resumeContext?: ManualVerificationContext;
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

export type Money = {
  amount: number;
  currency: "CNY" | "JPY" | "USD" | "EUR";
  display: string;
};

export type TrustLevel = "high" | "medium" | "low";

export type HotelResult = {
  id: string;
  taskId: string;
  hotelName: string;
  location: string;
  platform: PlatformCode;
  listPrice?: Money;
  detailPrice?: Money;
  isLowestDetailPrice: boolean;
  trustLevel: TrustLevel;
  trustReasons: string[];
  screenshotPath?: string;
  sourceUrl?: string;
  collectedAt: string;
};

export type TaskResultsSummary = {
  totalResults: number;
  detailPriceCount: number;
  lowestDetailPrice?: Money;
  platformCount: number;
  evidenceCompleteCount: number;
  generatedAt: string;
};

export type TaskResults = {
  task: Task;
  summary: TaskResultsSummary;
  results: HotelResult[];
};

export type TaskDetail = {
  task: Task;
  platforms: PlatformTask[];
  manualVerifications: ManualVerificationRecord[];
};

export type TaskEventType =
  | "task_snapshot"
  | "task_status_changed"
  | "platform_status_changed"
  | "manual_verification_requested"
  | "manual_verification_resumed"
  | "results_count_changed";

export type TaskEventResultsSummary = {
  totalResults: number;
  detailPriceCount: number;
  platformCount: number;
  evidenceCompleteCount: number;
  generatedAt: string;
};

export type TaskEventSnapshot = {
  detail: TaskDetail;
  resultsSummary: TaskEventResultsSummary;
};

export type TaskEvent =
  | {
      id: string;
      taskId: string;
      type: "task_snapshot";
      occurredAt: string;
      payload: TaskEventSnapshot;
    }
  | {
      id: string;
      taskId: string;
      type: "task_status_changed";
      occurredAt: string;
      payload: { task: Task };
    }
  | {
      id: string;
      taskId: string;
      type: "platform_status_changed";
      occurredAt: string;
      payload: {
        platformTask: PlatformTask;
        resultsSummary: TaskEventResultsSummary;
      };
    }
  | {
      id: string;
      taskId: string;
      type: "manual_verification_requested";
      occurredAt: string;
      payload: { manualVerification: ManualVerificationRecord };
    }
  | {
      id: string;
      taskId: string;
      type: "manual_verification_resumed";
      occurredAt: string;
      payload: { manualVerification: ManualVerificationRecord };
    }
  | {
      id: string;
      taskId: string;
      type: "results_count_changed";
      occurredAt: string;
      payload: { resultsSummary: TaskEventResultsSummary };
    };
