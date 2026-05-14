import type { PlatformCode } from '../task/task.types.js';

export type BrowserSessionStatus =
  | 'starting'
  | 'ready'
  | 'waiting_manual_verification'
  | 'closing'
  | 'closed'
  | 'failed';

export type BrowserEvidenceKind = 'list_page' | 'detail_page' | 'manual_verification' | 'error';

export type BrowserSessionOptions = {
  taskId: string;
  platform: PlatformCode;
  headless?: boolean;
};

export type BrowserAgentOptions = {
  profilesRoot: string;
  screenshotsRoot: string;
  maxSessions: number;
  defaultHeadless: boolean;
};

export type BrowserEvidenceMetadata = {
  taskId: string;
  platform: PlatformCode;
  kind: BrowserEvidenceKind;
  hotelName?: string;
};

export type ManualVerificationRequest = {
  taskId: string;
  platform: PlatformCode;
  reason: string;
  screenshotPath?: string;
  requestedAt: string;
};

export type BrowserSessionSnapshot = {
  taskId: string;
  platform: PlatformCode;
  status: BrowserSessionStatus;
  profileDir: string;
  currentUrl?: string;
  waitingReason?: string;
  lastActivityAt: string;
};
