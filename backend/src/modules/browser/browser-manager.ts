import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { PlatformCode } from '../task/task.types.js';
import type {
  BrowserAgentOptions,
  BrowserEvidenceMetadata,
  BrowserSessionOptions,
  BrowserSessionSnapshot,
  BrowserSessionStatus,
  ManualVerificationRequest,
} from './browser.types.js';

type ManualVerificationWaiter = {
  request: ManualVerificationRequest;
  resolve: () => void;
};

type BrowserSessionRecord = {
  taskId: string;
  platform: PlatformCode;
  status: BrowserSessionStatus;
  profileDir: string;
  context: BrowserContext;
  page: Page;
  lastActivityAt: string;
  manualVerificationWaiter?: ManualVerificationWaiter;
};

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

const timestampForFileName = (date = new Date()): string =>
  date.toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');

const safePathSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';

export class BrowserManager {
  private readonly sessions = new Map<PlatformCode, BrowserSessionRecord>();

  constructor(private readonly options: BrowserAgentOptions) {}

  async openSession(sessionOptions: BrowserSessionOptions): Promise<BrowserSessionSnapshot> {
    const existing = this.sessions.get(sessionOptions.platform);

    if (existing && existing.status !== 'closed') {
      existing.taskId = sessionOptions.taskId;
      this.touch(existing, 'ready');
      return this.toSnapshot(existing);
    }

    if (this.sessions.size >= this.options.maxSessions) {
      throw new Error(`Browser session limit reached: ${this.options.maxSessions}`);
    }

    const profileDir = path.join(this.options.profilesRoot, sessionOptions.platform);
    await mkdir(profileDir, { recursive: true });

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: sessionOptions.headless ?? this.options.defaultHeadless,
      viewport: DEFAULT_VIEWPORT,
    });

    const pages = context.pages();
    const page = pages[0] ?? (await context.newPage());

    const session: BrowserSessionRecord = {
      taskId: sessionOptions.taskId,
      platform: sessionOptions.platform,
      status: 'ready',
      profileDir,
      context,
      page,
      lastActivityAt: new Date().toISOString(),
    };

    this.sessions.set(session.platform, session);
    return this.toSnapshot(session);
  }

  async openPage(platform: PlatformCode, url: string): Promise<BrowserSessionSnapshot> {
    const session = this.requireSession(platform);
    await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    this.touch(session, 'ready');
    return this.toSnapshot(session);
  }

  async takeEvidenceScreenshot(metadata: BrowserEvidenceMetadata): Promise<string> {
    const session = this.requireSession(metadata.platform);
    const screenshotDir = path.join(
      this.options.screenshotsRoot,
      safePathSegment(metadata.taskId),
      metadata.platform,
    );
    await mkdir(screenshotDir, { recursive: true });

    const fileNameParts = [timestampForFileName(), metadata.kind];
    if (metadata.hotelName) {
      fileNameParts.push(safePathSegment(metadata.hotelName));
    }

    const screenshotPath = path.join(screenshotDir, `${fileNameParts.join('-')}.png`);
    await session.page.screenshot({ path: screenshotPath, fullPage: true });
    this.touch(session);
    return screenshotPath;
  }

  async requestManualVerification(
    request: Omit<ManualVerificationRequest, 'requestedAt'>,
  ): Promise<ManualVerificationRequest> {
    const session = this.requireSession(request.platform);

    const manualRequest: ManualVerificationRequest = {
      ...request,
      requestedAt: new Date().toISOString(),
    };

    if (!manualRequest.screenshotPath) {
      manualRequest.screenshotPath = await this.takeEvidenceScreenshot({
        taskId: request.taskId,
        platform: request.platform,
        kind: 'manual_verification',
      });
    }

    session.manualVerificationWaiter = {
      request: manualRequest,
      resolve: () => undefined,
    };
    this.touch(session, 'waiting_manual_verification');

    return manualRequest;
  }

  waitForManualVerification(platform: PlatformCode): Promise<void> {
    const session = this.requireSession(platform);

    if (session.status !== 'waiting_manual_verification' || !session.manualVerificationWaiter) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const currentRequest = session.manualVerificationWaiter?.request;
      if (!currentRequest) {
        resolve();
        return;
      }

      session.manualVerificationWaiter = {
        request: currentRequest,
        resolve,
      };
    });
  }

  resumeManualVerification(platform: PlatformCode): BrowserSessionSnapshot {
    const session = this.requireSession(platform);
    session.manualVerificationWaiter?.resolve();
    session.manualVerificationWaiter = undefined;
    this.touch(session, 'ready');
    return this.toSnapshot(session);
  }

  async closeSession(platform: PlatformCode): Promise<void> {
    const session = this.sessions.get(platform);
    if (!session) {
      return;
    }

    this.touch(session, 'closing');
    session.manualVerificationWaiter?.resolve();
    await session.context.close();
    this.touch(session, 'closed');
    this.sessions.delete(platform);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((platform) => this.closeSession(platform)));
  }

  listSessions(): BrowserSessionSnapshot[] {
    return [...this.sessions.values()].map((session) => this.toSnapshot(session));
  }

  getSession(platform: PlatformCode): BrowserSessionSnapshot | null {
    const session = this.sessions.get(platform);
    return session ? this.toSnapshot(session) : null;
  }

  private requireSession(platform: PlatformCode): BrowserSessionRecord {
    const session = this.sessions.get(platform);
    if (!session || session.status === 'closed') {
      throw new Error(`Browser session is not open for platform: ${platform}`);
    }

    return session;
  }

  private touch(session: BrowserSessionRecord, status?: BrowserSessionStatus): void {
    if (status) {
      session.status = status;
    }
    session.lastActivityAt = new Date().toISOString();
  }

  private toSnapshot(session: BrowserSessionRecord): BrowserSessionSnapshot {
    return {
      taskId: session.taskId,
      platform: session.platform,
      status: session.status,
      profileDir: session.profileDir,
      currentUrl: session.page.url(),
      waitingReason: session.manualVerificationWaiter?.request.reason,
      lastActivityAt: session.lastActivityAt,
    };
  }
}
