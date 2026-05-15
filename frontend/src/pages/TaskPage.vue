<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { getTaskDetail, pauseTask, resumeManualVerification, resumeTask, skipPlatform } from '@/api/tasks';
import type { ManualVerificationRecord, PlatformCode, PlatformTask, PlatformTaskStatus, TaskDetail, TaskStatus } from '@/types/task';

const route = useRoute();

const platformLabels: Record<PlatformCode, string> = {
  ctrip: '携程',
  booking: 'Booking',
  fliggy: '飞猪',
  meituan: '美团',
};

const taskStatusLabels: Record<TaskStatus, string> = {
  created: '已创建',
  running: '运行中',
  waiting_manual_verification: '等待人工验证',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const platformStatusLabels: Record<PlatformTaskStatus, string> = {
  pending: '等待调度',
  opening: '正在打开页面',
  searching: '搜索酒店列表',
  collecting_list: '采集列表价',
  confirming_detail: '确认详情价',
  saving_evidence: '保存证据',
  waiting_manual_verification: '等待人工验证',
  skipped: '已跳过',
  completed: '已完成',
  failed: '失败',
};

const detail = ref<TaskDetail | null>(null);
const isLoading = ref(false);
const actionKey = ref('');
const errorMessage = ref('');

const taskId = computed(() => {
  const value = route.params.taskId;
  return typeof value === 'string' ? value : '';
});

const activeManualVerifications = computed(() =>
  detail.value?.manualVerifications.filter((record) => record.status === 'waiting') ?? [],
);

const loadTask = async (): Promise<void> => {
  if (!taskId.value) {
    detail.value = null;
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    detail.value = await getTaskDetail(taskId.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '查询任务详情失败。';
  } finally {
    isLoading.value = false;
  }
};

const runAction = async (key: string, action: () => Promise<TaskDetail | void>): Promise<void> => {
  if (!taskId.value) {
    return;
  }

  actionKey.value = key;
  errorMessage.value = '';

  try {
    const result = await action();
    detail.value = result ?? (await getTaskDetail(taskId.value));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '操作失败，请稍后重试。';
  } finally {
    actionKey.value = '';
  }
};

const handleResumeTask = (): Promise<void> => runAction('resume-task', () => resumeTask(taskId.value));
const handlePauseTask = (): Promise<void> => runAction('pause-task', () => pauseTask(taskId.value));
const handleSkipPlatform = (platform: PlatformCode): Promise<void> =>
  runAction(`skip-${platform}`, () => skipPlatform(taskId.value, platform));
const handleResumeManualVerification = (platform: PlatformCode): Promise<void> =>
  runAction(`manual-${platform}`, () => resumeManualVerification(taskId.value, platform));

const findManualVerification = (platformTask: PlatformTask): ManualVerificationRecord | undefined =>
  detail.value?.manualVerifications.find((record) => record.id === platformTask.manualVerificationId) ??
  detail.value?.manualVerifications.find(
    (record) => record.platform === platformTask.platform && record.status === 'waiting',
  );

const formatDateTime = (value: string): string => new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const canPause = computed(() => detail.value?.task.status === 'running');
const canResume = computed(() => detail.value?.task.status === 'created' || detail.value?.task.status === 'paused');

watch(taskId, () => {
  void loadTask();
});

onMounted(() => {
  void loadTask();
});
</script>

<template>
  <section class="grid gap-6">
    <div v-if="!taskId" class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
      <p class="text-sm font-medium uppercase tracking-[0.3em] text-amber-300">Task</p>
      <h1 class="mt-4 text-3xl font-bold text-white">请选择一个任务</h1>
      <p class="mt-4 max-w-2xl text-slate-300">请先在首页创建查询任务，再进入任务执行页查看联调结果。</p>
      <RouterLink class="mt-6 inline-flex rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950" to="/">
        返回首页创建任务
      </RouterLink>
    </div>

    <template v-else>
      <div class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-sm font-medium uppercase tracking-[0.3em] text-amber-300">Task</p>
            <h1 class="mt-4 text-3xl font-bold text-white">{{ detail?.task.name ?? '任务详情' }}</h1>
            <p class="mt-3 text-sm text-slate-400">任务 ID：{{ taskId }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500" type="button" @click="loadTask">
              {{ isLoading ? '刷新中…' : '刷新详情' }}
            </button>
            <button
              class="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="!canResume || actionKey === 'resume-task'"
              type="button"
              @click="handleResumeTask"
            >
              {{ actionKey === 'resume-task' ? '恢复中…' : '开始 / 恢复' }}
            </button>
            <button
              class="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="!canPause || actionKey === 'pause-task'"
              type="button"
              @click="handlePauseTask"
            >
              {{ actionKey === 'pause-task' ? '暂停中…' : '暂停' }}
            </button>
          </div>
        </div>

        <p v-if="errorMessage" class="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {{ errorMessage }}
        </p>

        <div v-if="isLoading && !detail" class="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-slate-300">
          正在加载任务详情…
        </div>

        <div v-if="detail" class="mt-8 grid gap-4 lg:grid-cols-4">
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">状态</p>
            <p class="mt-2 text-xl font-semibold text-white">{{ taskStatusLabels[detail.task.status] }}</p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">查询条件</p>
            <p class="mt-2 text-white">
              {{ detail.task.criteria.destination }}，{{ detail.task.criteria.checkInDate }} 至 {{ detail.task.criteria.checkOutDate }}，{{ detail.task.criteria.adults }} 人
            </p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">平台</p>
            <p class="mt-2 text-white">{{ detail.task.criteria.platforms.map((platform) => platformLabels[platform]).join(' / ') }}</p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">更新时间</p>
            <p class="mt-2 text-white">{{ formatDateTime(detail.task.updatedAt) }}</p>
          </div>
        </div>
      </div>

      <div v-if="activeManualVerifications.length > 0" class="rounded-3xl border border-amber-300/40 bg-amber-400/10 p-6">
        <h2 class="text-xl font-semibold text-amber-100">等待人工验证</h2>
        <div class="mt-4 grid gap-3">
          <div v-for="record in activeManualVerifications" :key="record.id" class="rounded-2xl border border-amber-300/30 bg-slate-950/60 p-4">
            <p class="font-medium text-white">{{ platformLabels[record.platform] }}：{{ record.reason }}</p>
            <p class="mt-2 text-sm text-amber-100">请求时间：{{ formatDateTime(record.requestedAt) }}</p>
            <p v-if="record.screenshotPath" class="mt-2 text-sm text-slate-300">截图证据：{{ record.screenshotPath }}</p>
            <button
              class="mt-4 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="actionKey === `manual-${record.platform}`"
              type="button"
              @click="handleResumeManualVerification(record.platform)"
            >
              {{ actionKey === `manual-${record.platform}` ? '恢复中…' : '我已完成，继续' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="detail" class="grid gap-4 lg:grid-cols-2">
        <article v-for="platformTask in detail.platforms" :key="platformTask.id" class="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-semibold text-white">{{ platformLabels[platformTask.platform] }}</h2>
              <p class="mt-2 text-sm text-slate-400">已采集：{{ platformTask.collectedCount }} 家酒店</p>
            </div>
            <span class="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">
              {{ platformStatusLabels[platformTask.status] }}
            </span>
          </div>

          <dl class="mt-5 grid gap-3 text-sm">
            <div class="rounded-2xl bg-slate-950/70 p-4">
              <dt class="text-slate-400">当前步骤</dt>
              <dd class="mt-1 text-slate-100">{{ platformTask.currentStep }}</dd>
            </div>
            <div v-if="platformTask.issue" class="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
              <dt class="text-red-200">问题</dt>
              <dd class="mt-1 text-red-100">{{ platformTask.issue }}</dd>
            </div>
          </dl>

          <div v-if="findManualVerification(platformTask)" class="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            人工验证：{{ findManualVerification(platformTask)?.reason }}
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <button class="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500" type="button">
              查看浏览器（后续阶段）
            </button>
            <button
              class="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="platformTask.status === 'skipped' || actionKey === `skip-${platformTask.platform}`"
              type="button"
              @click="handleSkipPlatform(platformTask.platform)"
            >
              {{ actionKey === `skip-${platformTask.platform}` ? '跳过中…' : '跳过平台' }}
            </button>
            <button
              v-if="platformTask.status === 'waiting_manual_verification'"
              class="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              :disabled="actionKey === `manual-${platformTask.platform}`"
              type="button"
              @click="handleResumeManualVerification(platformTask.platform)"
            >
              {{ actionKey === `manual-${platformTask.platform}` ? '恢复中…' : '人工处理完成，继续' }}
            </button>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
