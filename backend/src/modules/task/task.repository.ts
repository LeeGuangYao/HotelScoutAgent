import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { getSqliteDatabasePath } from "../../shared/paths.js";
import type {
  HotelResult,
  ManualVerificationRecord,
  Money,
  PlatformTask,
  Task,
} from "./task.types.js";

const cloneTask = (task: Task): Task => ({
  ...task,
  criteria: {
    ...task.criteria,
    keywords: task.criteria.keywords ? [...task.criteria.keywords] : undefined,
    platforms: [...task.criteria.platforms],
  },
});

const clonePlatformTask = (platformTask: PlatformTask): PlatformTask => ({
  ...platformTask,
});

const cloneManualVerification = (
  record: ManualVerificationRecord,
): ManualVerificationRecord => ({
  ...record,
  resumeContext: record.resumeContext ? { ...record.resumeContext } : undefined,
});

const cloneHotelResult = (result: HotelResult): HotelResult => ({
  ...result,
  listPrice: result.listPrice ? { ...result.listPrice } : undefined,
  detailPrice: result.detailPrice ? { ...result.detailPrice } : undefined,
  trustReasons: [...result.trustReasons],
});

type Row = Record<string, SQLOutputValue>;

export class TaskRepository {
  private readonly db: DatabaseSync;

  constructor(databasePath = getSqliteDatabasePath()) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.initializeSchema();
  }

  async save(task: Task): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO tasks (id, name, criteria_json, status, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          criteria_json = excluded.criteria_json,
          status = excluded.status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at
      `)
      .run(
        task.id,
        task.name,
        stringifyJson(task.criteria),
        task.status,
        task.createdAt,
        task.updatedAt,
        task.completedAt ?? null,
      );
  }

  async findById(taskId: string): Promise<Task | null> {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId);
    return row ? cloneTask(taskFromRow(row)) : null;
  }

  async savePlatformTask(platformTask: PlatformTask): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO platform_tasks (
          id, task_id, platform, status, current_step, collected_count,
          issue, manual_verification_id, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          task_id = excluded.task_id,
          platform = excluded.platform,
          status = excluded.status,
          current_step = excluded.current_step,
          collected_count = excluded.collected_count,
          issue = excluded.issue,
          manual_verification_id = excluded.manual_verification_id,
          updated_at = excluded.updated_at
      `)
      .run(
        platformTask.id,
        platformTask.taskId,
        platformTask.platform,
        platformTask.status,
        platformTask.currentStep,
        platformTask.collectedCount,
        platformTask.issue ?? null,
        platformTask.manualVerificationId ?? null,
        platformTask.updatedAt,
      );
  }

  async findPlatformTasksByTaskId(taskId: string): Promise<PlatformTask[]> {
    return this.db
      .prepare("SELECT * FROM platform_tasks WHERE task_id = ? ORDER BY id ASC")
      .all(taskId)
      .map(platformTaskFromRow)
      .map(clonePlatformTask);
  }

  async findPlatformTask(
    taskId: string,
    platform: PlatformTask["platform"],
  ): Promise<PlatformTask | null> {
    const row = this.db
      .prepare("SELECT * FROM platform_tasks WHERE task_id = ? AND platform = ?")
      .get(taskId, platform);
    return row ? clonePlatformTask(platformTaskFromRow(row)) : null;
  }

  async saveManualVerification(record: ManualVerificationRecord): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO manual_verifications (
          id, task_id, platform, reason, status, previous_task_status,
          previous_platform_status, resume_to_task_status, resume_to_platform_status,
          screenshot_path, resume_context_json, requested_at, resumed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          task_id = excluded.task_id,
          platform = excluded.platform,
          reason = excluded.reason,
          status = excluded.status,
          previous_task_status = excluded.previous_task_status,
          previous_platform_status = excluded.previous_platform_status,
          resume_to_task_status = excluded.resume_to_task_status,
          resume_to_platform_status = excluded.resume_to_platform_status,
          screenshot_path = excluded.screenshot_path,
          resume_context_json = excluded.resume_context_json,
          requested_at = excluded.requested_at,
          resumed_at = excluded.resumed_at
      `)
      .run(
        record.id,
        record.taskId,
        record.platform,
        record.reason,
        record.status,
        record.previousTaskStatus,
        record.previousPlatformStatus,
        record.resumeToTaskStatus,
        record.resumeToPlatformStatus,
        record.screenshotPath ?? null,
        record.resumeContext ? stringifyJson(record.resumeContext) : null,
        record.requestedAt,
        record.resumedAt ?? null,
      );
  }

  async findManualVerificationsByTaskId(
    taskId: string,
  ): Promise<ManualVerificationRecord[]> {
    return this.db
      .prepare(
        "SELECT * FROM manual_verifications WHERE task_id = ? ORDER BY requested_at ASC",
      )
      .all(taskId)
      .map(manualVerificationFromRow)
      .map(cloneManualVerification);
  }

  async findActiveManualVerification(
    taskId: string,
    platform: PlatformTask["platform"],
  ): Promise<ManualVerificationRecord | null> {
    const row = this.db
      .prepare(`
        SELECT * FROM manual_verifications
        WHERE task_id = ? AND platform = ? AND status = 'waiting'
        ORDER BY requested_at DESC
        LIMIT 1
      `)
      .get(taskId, platform);

    return row ? cloneManualVerification(manualVerificationFromRow(row)) : null;
  }

  async saveHotelResults(results: HotelResult[]): Promise<void> {
    const statement = this.db.prepare(`
      INSERT INTO hotel_results (
        id, task_id, hotel_name, location, platform, list_price_json,
        detail_price_json, is_lowest_detail_price, trust_level, trust_reasons_json,
        screenshot_path, source_url, collected_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        hotel_name = excluded.hotel_name,
        location = excluded.location,
        platform = excluded.platform,
        list_price_json = excluded.list_price_json,
        detail_price_json = excluded.detail_price_json,
        is_lowest_detail_price = excluded.is_lowest_detail_price,
        trust_level = excluded.trust_level,
        trust_reasons_json = excluded.trust_reasons_json,
        screenshot_path = excluded.screenshot_path,
        source_url = excluded.source_url,
        collected_at = excluded.collected_at
    `);

    this.transaction(() => {
      for (const result of results) {
        statement.run(
          result.id,
          result.taskId,
          result.hotelName,
          result.location,
          result.platform,
          result.listPrice ? stringifyJson(result.listPrice) : null,
          result.detailPrice ? stringifyJson(result.detailPrice) : null,
          result.isLowestDetailPrice ? 1 : 0,
          result.trustLevel,
          stringifyJson(result.trustReasons),
          result.screenshotPath ?? null,
          result.sourceUrl ?? null,
          result.collectedAt,
        );
      }
    });
  }

  async findHotelResultsByTaskId(taskId: string): Promise<HotelResult[]> {
    return this.db
      .prepare(
        "SELECT * FROM hotel_results WHERE task_id = ? ORDER BY collected_at ASC, id ASC",
      )
      .all(taskId)
      .map(hotelResultFromRow)
      .map(cloneHotelResult);
  }

  close(): void {
    this.db.close();
  }

  private initializeSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        criteria_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS platform_tasks (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step TEXT NOT NULL,
        collected_count INTEGER NOT NULL,
        issue TEXT,
        manual_verification_id TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, platform)
      );

      CREATE TABLE IF NOT EXISTS manual_verifications (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL,
        previous_task_status TEXT NOT NULL,
        previous_platform_status TEXT NOT NULL,
        resume_to_task_status TEXT NOT NULL,
        resume_to_platform_status TEXT NOT NULL,
        screenshot_path TEXT,
        resume_context_json TEXT,
        requested_at TEXT NOT NULL,
        resumed_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS hotel_results (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        hotel_name TEXT NOT NULL,
        location TEXT NOT NULL,
        platform TEXT NOT NULL,
        list_price_json TEXT,
        detail_price_json TEXT,
        is_lowest_detail_price INTEGER NOT NULL,
        trust_level TEXT NOT NULL,
        trust_reasons_json TEXT NOT NULL,
        screenshot_path TEXT,
        source_url TEXT,
        collected_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_platform_tasks_task_id
        ON platform_tasks(task_id);
      CREATE INDEX IF NOT EXISTS idx_manual_verifications_task_id
        ON manual_verifications(task_id, requested_at);
      CREATE INDEX IF NOT EXISTS idx_hotel_results_task_id
        ON hotel_results(task_id, collected_at, id);
    `);
  }

  private transaction(callback: () => void): void {
    this.db.exec("BEGIN");
    try {
      callback();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

const stringifyJson = (value: unknown): string => JSON.stringify(value);

const text = (row: Row, key: string): string => String(row[key] ?? "");
const nullableText = (row: Row, key: string): string | undefined => {
  const value = row[key];
  return value === null || value === undefined ? undefined : String(value);
};
const integer = (row: Row, key: string): number => Number(row[key] ?? 0);

const parseJson = <T>(value: SQLOutputValue | undefined, fallback: T): T => {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }
  return JSON.parse(value) as T;
};

const taskFromRow = (row: Row): Task => ({
  id: text(row, "id"),
  name: text(row, "name"),
  criteria: parseJson(row.criteria_json, {
    destination: "",
    checkInDate: "",
    checkOutDate: "",
    adults: 1,
    platforms: [],
    sortBy: "price",
  }),
  status: text(row, "status") as Task["status"],
  createdAt: text(row, "created_at"),
  updatedAt: text(row, "updated_at"),
  completedAt: nullableText(row, "completed_at"),
});

const platformTaskFromRow = (row: Row): PlatformTask => ({
  id: text(row, "id"),
  taskId: text(row, "task_id"),
  platform: text(row, "platform") as PlatformTask["platform"],
  status: text(row, "status") as PlatformTask["status"],
  currentStep: text(row, "current_step"),
  collectedCount: integer(row, "collected_count"),
  issue: nullableText(row, "issue"),
  manualVerificationId: nullableText(row, "manual_verification_id"),
  updatedAt: text(row, "updated_at"),
});

const manualVerificationFromRow = (row: Row): ManualVerificationRecord => ({
  id: text(row, "id"),
  taskId: text(row, "task_id"),
  platform: text(row, "platform") as ManualVerificationRecord["platform"],
  reason: text(row, "reason"),
  status: text(row, "status") as ManualVerificationRecord["status"],
  previousTaskStatus: text(
    row,
    "previous_task_status",
  ) as ManualVerificationRecord["previousTaskStatus"],
  previousPlatformStatus: text(
    row,
    "previous_platform_status",
  ) as ManualVerificationRecord["previousPlatformStatus"],
  resumeToTaskStatus: text(
    row,
    "resume_to_task_status",
  ) as ManualVerificationRecord["resumeToTaskStatus"],
  resumeToPlatformStatus: text(
    row,
    "resume_to_platform_status",
  ) as ManualVerificationRecord["resumeToPlatformStatus"],
  screenshotPath: nullableText(row, "screenshot_path"),
  resumeContext: parseJson(row.resume_context_json, undefined),
  requestedAt: text(row, "requested_at"),
  resumedAt: nullableText(row, "resumed_at"),
});

const hotelResultFromRow = (row: Row): HotelResult => ({
  id: text(row, "id"),
  taskId: text(row, "task_id"),
  hotelName: text(row, "hotel_name"),
  location: text(row, "location"),
  platform: text(row, "platform") as HotelResult["platform"],
  listPrice: parseJson<Money | undefined>(row.list_price_json, undefined),
  detailPrice: parseJson<Money | undefined>(row.detail_price_json, undefined),
  isLowestDetailPrice: integer(row, "is_lowest_detail_price") === 1,
  trustLevel: text(row, "trust_level") as HotelResult["trustLevel"],
  trustReasons: parseJson<string[]>(row.trust_reasons_json, []),
  screenshotPath: nullableText(row, "screenshot_path"),
  sourceUrl: nullableText(row, "source_url"),
  collectedAt: text(row, "collected_at"),
});
