<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import {
  createTaskEventSource,
  getScreenshotPreviewUrl,
  getTaskDetail,
  pauseTask,
  resumeManualVerification,
  resumeTask,
  skipPlatform,
} from "@/api/tasks";
import type {
  ManualVerificationRecord,
  PlatformCode,
  PlatformTask,
  PlatformTaskStatus,
  TaskDetail,
  TaskEvent,
  TaskEventResultsSummary,
  TaskStatus,
} from "@/types/task";

const route = useRoute();

const platformLabels: Record<PlatformCode, string> = {
  ctrip: "携程",
  booking: "Booking",
  fliggy: "飞猪",
  meituan: "美团",
};

const taskStatusLabels: Record<TaskStatus, string> = {
  created: "已创建",
  running: "运行中",
  waiting_manual_verification: "等待人工验证",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const platformStatusLabels: Record<PlatformTaskStatus, string> = {
  pending: "等待调度",
  opening: "正在打开页面",
  searching: "搜索酒店列表",
  collecting_list: "采集列表价",
  confirming_detail: "确认详情价",
  saving_evidence: "保存证据",
  waiting_manual_verification: "等待人工验证",
  skipped: "已跳过",
  completed: "已完成",
  failed: "失败",
};

const detail = ref<TaskDetail | null>(null);
const isLoading = ref(false);
const actionKey = ref("");
const errorMessage = ref("");
const realtimeStatus = ref<
  "closed" | "connecting" | "open" | "error" | "unsupported"
>("closed");
const realtimeMessage = ref("实时事件流尚未连接。");
const latestEventAt = ref("");
const eventResultsSummary = ref<TaskEventResultsSummary | null>(null);
const manualEvidenceImageErrors = ref<Record<string, boolean>>({});
let taskEventSource: EventSource | null = null;

const taskId = computed(() => {
  const value = route.params.taskId;
  return typeof value === "string" ? value : "";
});

const activeManualVerifications = computed(
  () =>
    detail.value?.manualVerifications.filter(
      (record) => record.status === "waiting",
    ) ?? [],
);

const manualEvidencePreviewUrl = (screenshotPath: string): string =>
  getScreenshotPreviewUrl(screenshotPath);

const markManualEvidenceImageError = (recordId: string): void => {
  manualEvidenceImageErrors.value = {
    ...manualEvidenceImageErrors.value,
    [recordId]: true,
  };
};

const loadTask = async (): Promise<void> => {
  if (!taskId.value) {
    detail.value = null;
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    detail.value = await getTaskDetail(taskId.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "查询任务详情失败。";
  } finally {
    isLoading.value = false;
  }
};

const runAction = async (
  key: string,
  action: () => Promise<TaskDetail | void>,
): Promise<void> => {
  if (!taskId.value) {
    return;
  }

  actionKey.value = key;
  errorMessage.value = "";

  try {
    const result = await action();
    detail.value = result ?? (await getTaskDetail(taskId.value));
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "操作失败，请稍后重试。";
  } finally {
    actionKey.value = "";
  }
};

const handleResumeTask = (): Promise<void> =>
  runAction("resume-task", () => resumeTask(taskId.value));
const handlePauseTask = (): Promise<void> =>
  runAction("pause-task", () => pauseTask(taskId.value));
const handleSkipPlatform = (platform: PlatformCode): Promise<void> =>
  runAction(`skip-${platform}`, () => skipPlatform(taskId.value, platform));
const handleResumeManualVerification = (
  platform: PlatformCode,
): Promise<void> =>
  runAction(`manual-${platform}`, () =>
    resumeManualVerification(taskId.value, platform),
  );

const upsertManualVerification = (record: ManualVerificationRecord): void => {
  if (!detail.value) {
    return;
  }

  const index = detail.value.manualVerifications.findIndex(
    (candidate) => candidate.id === record.id,
  );
  const manualVerifications = [...detail.value.manualVerifications];
  if (index >= 0) {
    manualVerifications[index] = record;
  } else {
    manualVerifications.push(record);
  }

  detail.value = {
    ...detail.value,
    manualVerifications,
  };
};

const applyTaskEvent = (event: TaskEvent): void => {
  latestEventAt.value = event.occurredAt;

  if (event.type === "task_snapshot") {
    detail.value = event.payload.detail;
    eventResultsSummary.value = event.payload.resultsSummary;
    realtimeMessage.value = "已接收任务快照，后续变更将自动推送。";
    return;
  }

  if (event.type === "task_status_changed" && detail.value) {
    detail.value = {
      ...detail.value,
      task: event.payload.task,
    };
    realtimeMessage.value = `任务状态已更新为：${taskStatusLabels[event.payload.task.status]}`;
    return;
  }

  if (event.type === "platform_status_changed" && detail.value) {
    detail.value = {
      ...detail.value,
      platforms: detail.value.platforms.map((platformTask) =>
        platformTask.platform === event.payload.platformTask.platform
          ? event.payload.platformTask
          : platformTask,
      ),
    };
    eventResultsSummary.value = event.payload.resultsSummary;
    realtimeMessage.value = `${platformLabels[event.payload.platformTask.platform]} 已更新：${platformStatusLabels[event.payload.platformTask.status]}`;
    return;
  }

  if (event.type === "manual_verification_requested") {
    upsertManualVerification(event.payload.manualVerification);
    realtimeMessage.value = `${platformLabels[event.payload.manualVerification.platform]} 请求人工验证。`;
    return;
  }

  if (event.type === "manual_verification_resumed") {
    upsertManualVerification(event.payload.manualVerification);
    realtimeMessage.value = `${platformLabels[event.payload.manualVerification.platform]} 人工验证已恢复。`;
    return;
  }

  if (event.type === "results_count_changed") {
    eventResultsSummary.value = event.payload.resultsSummary;
    realtimeMessage.value = `结果数量已更新：${event.payload.resultsSummary.totalResults} 条。`;
  }
};

const parseTaskEvent = (message: MessageEvent<string>): void => {
  const event = JSON.parse(message.data) as TaskEvent;
  applyTaskEvent(event);
};

const disconnectTaskEvents = (): void => {
  taskEventSource?.close();
  taskEventSource = null;
  if (realtimeStatus.value !== "unsupported") {
    realtimeStatus.value = "closed";
  }
};

const connectTaskEvents = (): void => {
  disconnectTaskEvents();

  if (!taskId.value) {
    realtimeMessage.value = "缺少任务 ID，无法订阅事件流。";
    return;
  }

  if (typeof EventSource === "undefined") {
    realtimeStatus.value = "unsupported";
    realtimeMessage.value = "当前浏览器不支持 EventSource，请使用手动刷新。";
    return;
  }

  realtimeStatus.value = "connecting";
  realtimeMessage.value = "正在连接任务实时事件流…";
  taskEventSource = createTaskEventSource(taskId.value);

  const eventTypes: TaskEvent["type"][] = [
    "task_snapshot",
    "task_status_changed",
    "platform_status_changed",
    "manual_verification_requested",
    "manual_verification_resumed",
    "results_count_changed",
  ];

  taskEventSource.onopen = () => {
    realtimeStatus.value = "open";
    realtimeMessage.value = "实时事件流已连接。";
  };

  taskEventSource.onerror = () => {
    realtimeStatus.value = "error";
    realtimeMessage.value =
      "实时事件流连接中断，页面会尝试自动重连；也可以手动刷新详情。";
  };

  eventTypes.forEach((eventType) => {
    taskEventSource?.addEventListener(
      eventType,
      parseTaskEvent as EventListener,
    );
  });
};

const findManualVerification = (
  platformTask: PlatformTask,
): ManualVerificationRecord | undefined =>
  detail.value?.manualVerifications.find(
    (record) => record.id === platformTask.manualVerificationId,
  ) ??
  detail.value?.manualVerifications.find(
    (record) =>
      record.platform === platformTask.platform && record.status === "waiting",
  );

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const canPause = computed(() => detail.value?.task.status === "running");
const canResume = computed(
  () =>
    detail.value?.task.status === "created" ||
    detail.value?.task.status === "paused",
);

watch(taskId, () => {
  void loadTask();
  connectTaskEvents();
});

onMounted(() => {
  void loadTask();
  connectTaskEvents();
});

onUnmounted(() => {
  disconnectTaskEvents();
});
</script>

<template>
  <section class="grid gap-6">
    <div
      v-if="!taskId"
      class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40"
    >
      <p class="text-sm font-medium uppercase tracking-[0.3em] text-amber-300">
        Task
      </p>
      <h1 class="mt-4 text-3xl font-bold text-white">请选择一个任务</h1>
      <p class="mt-4 max-w-2xl text-slate-300">
        请先在首页创建查询任务，再进入任务执行页查看联调结果。
      </p>
      <RouterLink
        class="mt-6 inline-flex rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950"
        to="/"
      >
        返回首页创建任务
      </RouterLink>
    </div>

    <template v-else>
      <div
        class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40"
      >
        <div
          class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        >
          <div>
            <p
              class="text-sm font-medium uppercase tracking-[0.3em] text-amber-300"
            >
              Task
            </p>
            <h1 class="mt-4 text-3xl font-bold text-white">
              {{ detail?.task.name ?? "任务详情" }}
            </h1>
            <p class="mt-3 text-sm text-slate-400">任务 ID：{{ taskId }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              class="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
              type="button"
              @click="loadTask"
            >
              {{ isLoading ? "刷新中…" : "刷新详情" }}
            </button>
            <button
              class="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="!canResume || actionKey === 'resume-task'"
              type="button"
              @click="handleResumeTask"
            >
              {{ actionKey === "resume-task" ? "恢复中…" : "开始 / 恢复" }}
            </button>
            <button
              class="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="!canPause || actionKey === 'pause-task'"
              type="button"
              @click="handlePauseTask"
            >
              {{ actionKey === "pause-task" ? "暂停中…" : "暂停" }}
            </button>
            <RouterLink
              class="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              :to="{ name: 'task-results', params: { taskId } }"
            >
              查看结果
            </RouterLink>
          </div>
        </div>

        <p
          v-if="errorMessage"
          class="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {{ errorMessage }}
        </p>

        <div
          class="mt-6 rounded-2xl border px-4 py-3 text-sm"
          :class="
            realtimeStatus === 'error' || realtimeStatus === 'unsupported'
              ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
              : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
          "
        >
          <div
            class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
          >
            <p>
              实时更新：{{ realtimeMessage }}
              <span v-if="latestEventAt" class="text-slate-300"
                >最近事件 {{ formatDateTime(latestEventAt) }}</span
              >
            </p>
            <button
              class="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-100 transition hover:border-slate-400"
              type="button"
              @click="connectTaskEvents"
            >
              重新连接
            </button>
          </div>
        </div>

        <div
          v-if="isLoading && !detail"
          class="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-slate-300"
        >
          正在加载任务详情…
        </div>

        <div v-if="detail" class="mt-8 grid gap-4 lg:grid-cols-5">
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">状态</p>
            <p class="mt-2 text-xl font-semibold text-white">
              {{ taskStatusLabels[detail.task.status] }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">查询条件</p>
            <p class="mt-2 text-white">
              {{ detail.task.criteria.destination }}，{{
                detail.task.criteria.checkInDate
              }}
              至 {{ detail.task.criteria.checkOutDate }}，{{
                detail.task.criteria.adults
              }}
              人
            </p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">平台</p>
            <p class="mt-2 text-white">
              {{
                detail.task.criteria.platforms
                  .map((platform) => platformLabels[platform])
                  .join(" / ")
              }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">更新时间</p>
            <p class="mt-2 text-white">
              {{ formatDateTime(detail.task.updatedAt) }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">结果数量</p>
            <p class="mt-2 text-white">
              {{
                eventResultsSummary?.totalResults ??
                detail.platforms.reduce(
                  (sum, platformTask) => sum + platformTask.collectedCount,
                  0,
                )
              }}
              条
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="activeManualVerifications.length > 0"
        class="rounded-3xl border border-amber-300/40 bg-amber-400/10 p-6"
      >
        <h2 class="text-xl font-semibold text-amber-100">等待人工验证</h2>
        <div class="mt-4 grid gap-3">
          <div
            v-for="record in activeManualVerifications"
            :key="record.id"
            class="rounded-2xl border border-amber-300/30 bg-slate-950/60 p-4"
          >
            <p class="font-medium text-white">
              {{ platformLabels[record.platform] }}：{{ record.reason }}
            </p>
            <p class="mt-2 text-sm text-amber-100">
              请求时间：{{ formatDateTime(record.requestedAt) }}
            </p>
            <div
              v-if="record.screenshotPath"
              class="mt-3 overflow-hidden rounded-2xl border border-amber-300/20 bg-slate-950/70"
            >
              <img
                v-if="!manualEvidenceImageErrors[record.id]"
                class="max-h-64 w-full object-contain"
                :src="manualEvidencePreviewUrl(record.screenshotPath)"
                :alt="`${platformLabels[record.platform]} 人工验证截图证据`"
                @error="markManualEvidenceImageError(record.id)"
              >
              <div v-else class="p-4 text-sm text-amber-100">
                暂时无法预览该截图，请确认文件仍在项目 screenshots 目录内。
              </div>
              <p class="break-all px-4 py-3 text-xs text-slate-400">
                截图证据：{{ record.screenshotPath }}
              </p>
            </div>
            <button
              class="mt-4 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="actionKey === `manual-${record.platform}`"
              type="button"
              @click="handleResumeManualVerification(record.platform)"
            >
              {{
                actionKey === `manual-${record.platform}`
                  ? "恢复中…"
                  : "我已完成，继续"
              }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="detail" class="grid gap-4 lg:grid-cols-2">
        <article
          v-for="platformTask in detail.platforms"
          :key="platformTask.id"
          class="rounded-3xl border border-slate-800 bg-slate-900/70 p-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-semibold text-white">
                {{ platformLabels[platformTask.platform] }}
              </h2>
              <p class="mt-2 text-sm text-slate-400">
                已采集：{{ platformTask.collectedCount }} 家酒店
              </p>
            </div>
            <span
              class="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200"
            >
              {{ platformStatusLabels[platformTask.status] }}
            </span>
          </div>

          <dl class="mt-5 grid gap-3 text-sm">
            <div class="rounded-2xl bg-slate-950/70 p-4">
              <dt class="text-slate-400">当前步骤</dt>
              <dd class="mt-1 text-slate-100">
                {{ platformTask.currentStep }}
              </dd>
            </div>
            <div
              v-if="platformTask.issue"
              class="rounded-2xl border border-red-400/30 bg-red-500/10 p-4"
            >
              <dt class="text-red-200">问题</dt>
              <dd class="mt-1 text-red-100">{{ platformTask.issue }}</dd>
            </div>
          </dl>

          <div
            v-if="findManualVerification(platformTask)"
            class="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100"
          >
            人工验证：{{ findManualVerification(platformTask)?.reason }}
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <button
              class="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
              type="button"
            >
              查看浏览器（后续阶段）
            </button>
            <button
              class="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="
                platformTask.status === 'skipped' ||
                actionKey === `skip-${platformTask.platform}`
              "
              type="button"
              @click="handleSkipPlatform(platformTask.platform)"
            >
              {{
                actionKey === `skip-${platformTask.platform}`
                  ? "跳过中…"
                  : "跳过平台"
              }}
            </button>
            <button
              v-if="platformTask.status === 'waiting_manual_verification'"
              class="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="actionKey === `manual-${platformTask.platform}`"
              type="button"
              @click="handleResumeManualVerification(platformTask.platform)"
            >
              {{
                actionKey === `manual-${platformTask.platform}`
                  ? "恢复中…"
                  : "人工处理完成，继续"
              }}
            </button>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
