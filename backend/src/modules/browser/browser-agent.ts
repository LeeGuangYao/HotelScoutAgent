import path from 'node:path';
import type { PlatformCode } from '../task/task.types.js';
import { BrowserManager } from './browser-manager.js';
import type {
  BrowserAgentOptions,
  BrowserEvidenceMetadata,
  BrowserSessionOptions,
  BrowserSessionSnapshot,
  ManualVerificationRequest,
} from './browser.types.js';

const DEFAULT_BROWSER_OPTIONS: BrowserAgentOptions = {
  profilesRoot: path.resolve('browser-profiles'),
  screenshotsRoot: path.resolve('screenshots'),
  maxSessions: 4,
  defaultHeadless: false,
};

export class BrowserAgent {
  private readonly manager: BrowserManager;

  constructor(options: Partial<BrowserAgentOptions> = {}) {
    this.manager = new BrowserManager({ ...DEFAULT_BROWSER_OPTIONS, ...options });
  }

  openSession(options: BrowserSessionOptions): Promise<BrowserSessionSnapshot> {
    return this.manager.openSession(options);
  }

  openPage(platform: PlatformCode, url: string): Promise<BrowserSessionSnapshot> {
    return this.manager.openPage(platform, url);
  }

  takeEvidenceScreenshot(metadata: BrowserEvidenceMetadata): Promise<string> {
    return this.manager.takeEvidenceScreenshot(metadata);
  }

  requestManualVerification(
    request: Omit<ManualVerificationRequest, 'requestedAt'>,
  ): Promise<ManualVerificationRequest> {
    return this.manager.requestManualVerification(request);
  }

  getSession(platform: PlatformCode): BrowserSessionSnapshot | null {
    return this.manager.getSession(platform);
  }

  waitForManualVerification(platform: PlatformCode): Promise<void> {
    return this.manager.waitForManualVerification(platform);
  }

  resumeManualVerification(platform: PlatformCode): BrowserSessionSnapshot {
    return this.manager.resumeManualVerification(platform);
  }

  closeSession(platform: PlatformCode): Promise<void> {
    return this.manager.closeSession(platform);
  }

  closeAll(): Promise<void> {
    return this.manager.closeAll();
  }

  listSessions(): BrowserSessionSnapshot[] {
    return this.manager.listSessions();
  }
}

export const createBrowserAgent = (options: Partial<BrowserAgentOptions> = {}): BrowserAgent =>
  new BrowserAgent(options);
