<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { getTaskResults } from '@/api/tasks';
import type { HotelResult, PlatformCode, TaskResults, TaskStatus, TrustLevel } from '@/types/task';

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

const trustLabels: Record<TrustLevel, string> = {
  high: '可信度高',
  medium: '可信度中',
  low: '可信度低',
};

const trustClasses: Record<TrustLevel, string> = {
  high: 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100',
  medium: 'border-amber-300/40 bg-amber-400/10 text-amber-100',
  low: 'border-red-300/40 bg-red-400/10 text-red-100',
};

const resultsData = ref<TaskResults | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');
const selectedPlatform = ref<'all' | PlatformCode>('all');
const selectedTrust = ref<'all' | TrustLevel>('all');
const onlyLowest = ref(false);
const onlyWithScreenshot = ref(false);
const keyword = ref('');
const selectedEvidence = ref<HotelResult | null>(null);

const taskId = computed(() => {
  const value = route.params.taskId;
  return typeof value === 'string' ? value : '';
});

const availablePlatforms = computed(() => resultsData.value?.task.criteria.platforms ?? []);

const filteredResults = computed(() => {
  const query = keyword.value.trim().toLowerCase();

  return (resultsData.value?.results ?? []).filter((result) => {
    if (selectedPlatform.value !== 'all' && result.platform !== selectedPlatform.value) {
      return false;
    }

    if (selectedTrust.value !== 'all' && result.trustLevel !== selectedTrust.value) {
      return false;
    }

    if (onlyLowest.value && !result.isLowestDetailPrice) {
      return false;
    }

    if (onlyWithScreenshot.value && !result.screenshotPath) {
      return false;
    }

    if (query && !`${result.hotelName} ${result.location}`.toLowerCase().includes(query)) {
      return false;
    }

    return true;
  });
});

const loadResults = async (): Promise<void> => {
  if (!taskId.value) {
    resultsData.value = null;
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    resultsData.value = await getTaskResults(taskId.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '查询结果失败。';
  } finally {
    isLoading.value = false;
  }
};

const clearFilters = (): void => {
  selectedPlatform.value = 'all';
  selectedTrust.value = 'all';
  onlyLowest.value = false;
  onlyWithScreenshot.value = false;
  keyword.value = '';
};

const formatDateTime = (value: string): string => new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const priceText = (result: HotelResult, type: 'list' | 'detail'): string => {
  const price = type === 'list' ? result.listPrice : result.detailPrice;
  if (price) {
    return price.display;
  }

  return type === 'list' ? '未采集' : '未确认';
};

const hasPriceDiff = (result: HotelResult): boolean =>
  Boolean(result.listPrice && result.detailPrice && result.listPrice.amount !== result.detailPrice.amount);

watch(taskId, () => {
  void loadResults();
});

onMounted(() => {
  void loadResults();
});
</script>

<template>
  <section class="grid gap-6">
    <div v-if="!taskId" class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
      <p class="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Results</p>
      <h1 class="mt-4 text-3xl font-bold text-white">请选择一个任务结果</h1>
      <p class="mt-4 max-w-2xl text-slate-300">请先创建任务，再通过任务执行页进入对应结果列表。</p>
      <RouterLink class="mt-6 inline-flex rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950" to="/">
        返回首页创建任务
      </RouterLink>
    </div>

    <template v-else>
      <div class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Results</p>
            <h1 class="mt-4 text-3xl font-bold text-white">比价结果</h1>
            <p class="mt-3 text-sm text-slate-400">任务 ID：{{ taskId }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500" type="button" @click="loadResults">
              {{ isLoading ? '刷新中…' : '刷新结果' }}
            </button>
            <RouterLink class="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white" :to="{ name: 'task', params: { taskId } }">
              返回任务页
            </RouterLink>
          </div>
        </div>

        <p class="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          价格为采集时点页面展示信息，可能受税费、会员价、库存和汇率影响；本页不承诺实时有效或全网最低。
        </p>

        <p v-if="errorMessage" class="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {{ errorMessage }}
        </p>

        <div v-if="isLoading && !resultsData" class="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-slate-300">
          正在加载结果列表…
        </div>

        <div v-if="resultsData" class="mt-8 grid gap-4 lg:grid-cols-5">
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">任务名称</p>
            <p class="mt-2 font-semibold text-white">{{ resultsData.task.name }}</p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">任务状态</p>
            <p class="mt-2 font-semibold text-white">{{ taskStatusLabels[resultsData.task.status] }}</p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">结果数</p>
            <p class="mt-2 font-semibold text-white">{{ resultsData.summary.totalResults }} 条</p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">最低详情价</p>
            <p class="mt-2 font-semibold text-white">{{ resultsData.summary.lowestDetailPrice?.display ?? '暂无可比较价格' }}</p>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p class="text-sm text-slate-400">证据完整</p>
            <p class="mt-2 font-semibold text-white">{{ resultsData.summary.evidenceCompleteCount }} / {{ resultsData.summary.totalResults }}</p>
          </div>
        </div>

        <div v-if="resultsData" class="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
          查询条件：{{ resultsData.task.criteria.destination }}，{{ resultsData.task.criteria.checkInDate }} 至 {{ resultsData.task.criteria.checkOutDate }}，{{ resultsData.task.criteria.adults }} 人；生成时间：{{ formatDateTime(resultsData.summary.generatedAt) }}。
        </div>
      </div>

      <div v-if="resultsData" class="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div class="grid gap-4 lg:grid-cols-5">
          <label class="grid gap-2 text-sm font-medium text-slate-200">
            平台筛选
            <select v-model="selectedPlatform" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300">
              <option value="all">全部平台</option>
              <option v-for="platform in availablePlatforms" :key="platform" :value="platform">{{ platformLabels[platform] }}</option>
            </select>
          </label>
          <label class="grid gap-2 text-sm font-medium text-slate-200">
            可信度
            <select v-model="selectedTrust" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300">
              <option value="all">全部可信度</option>
              <option value="high">可信度高</option>
              <option value="medium">可信度中</option>
              <option value="low">可信度低</option>
            </select>
          </label>
          <label class="grid gap-2 text-sm font-medium text-slate-200 lg:col-span-2">
            关键词搜索
            <input v-model="keyword" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" placeholder="酒店名称或位置" />
          </label>
          <div class="flex items-end">
            <button class="w-full rounded-full border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500" type="button" @click="clearFilters">
              清除筛选
            </button>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-4 text-sm text-slate-200">
          <label class="inline-flex items-center gap-2">
            <input v-model="onlyLowest" class="h-4 w-4" type="checkbox" />
            仅看当前最低详情价
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="onlyWithScreenshot" class="h-4 w-4" type="checkbox" />
            仅看有截图证据
          </label>
        </div>
      </div>

      <div v-if="resultsData && resultsData.summary.detailPriceCount === 0" class="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-6 text-amber-100">
        暂无可比较的详情确认价，因此不展示最低价标签。
      </div>

      <div v-if="resultsData" class="grid gap-4">
        <div v-if="filteredResults.length === 0" class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-slate-300">
          {{ resultsData.results.length === 0 ? '未获取到可展示的酒店结果。' : '当前筛选条件下无结果。' }}
        </div>

        <article v-for="result in filteredResults" :key="result.id" class="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="text-2xl font-semibold text-white">{{ result.hotelName }}</h2>
                <span class="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">{{ platformLabels[result.platform] }}</span>
                <span v-if="result.isLowestDetailPrice" class="rounded-full bg-emerald-300 px-3 py-1 text-sm font-semibold text-slate-950">当前最低详情价</span>
              </div>
              <p class="mt-2 text-slate-400">{{ result.location }}</p>
            </div>
            <span class="rounded-full border px-3 py-1 text-sm" :class="trustClasses[result.trustLevel]">
              {{ trustLabels[result.trustLevel] }}
            </span>
          </div>

          <div class="mt-6 grid gap-4 md:grid-cols-3">
            <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <p class="text-sm text-slate-400">列表页价格</p>
              <p class="mt-2 text-2xl font-bold text-white">{{ priceText(result, 'list') }}</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <p class="text-sm text-slate-400">详情确认价</p>
              <p class="mt-2 text-2xl font-bold text-emerald-200">{{ priceText(result, 'detail') }}</p>
              <p v-if="hasPriceDiff(result)" class="mt-2 text-sm text-amber-200">列表价与详情确认价不一致</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <p class="text-sm text-slate-400">采集时间</p>
              <p class="mt-2 text-white">{{ formatDateTime(result.collectedAt) }}</p>
            </div>
          </div>

          <div class="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <div class="rounded-2xl bg-slate-950/60 p-4">
              <p class="font-medium text-slate-100">可信度原因</p>
              <ul class="mt-2 list-disc space-y-1 pl-5">
                <li v-for="reason in result.trustReasons" :key="reason">{{ reason }}</li>
              </ul>
            </div>
            <div class="rounded-2xl bg-slate-950/60 p-4">
              <p class="font-medium text-slate-100">证据信息</p>
              <p class="mt-2">截图：{{ result.screenshotPath ?? '截图缺失，可信度已降低' }}</p>
              <p class="mt-2">来源 URL：<a v-if="result.sourceUrl" class="text-cyan-200 hover:text-cyan-100" :href="result.sourceUrl" target="_blank" rel="noreferrer">打开来源页面</a><span v-else>缺失</span></p>
              <button
                v-if="result.screenshotPath"
                class="mt-4 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                type="button"
                @click="selectedEvidence = result"
              >
                查看截图证据
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>

    <div v-if="selectedEvidence" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6" role="dialog" aria-modal="true">
      <div class="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-2xl font-semibold text-white">截图证据</h2>
            <p class="mt-2 text-sm text-slate-400">{{ selectedEvidence.hotelName }} · {{ platformLabels[selectedEvidence.platform] }}</p>
          </div>
          <button class="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-200" type="button" @click="selectedEvidence = null">关闭</button>
        </div>
        <div class="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center text-slate-300">
          本地截图路径：{{ selectedEvidence.screenshotPath }}
          <p class="mt-3 text-sm text-slate-500">第 9 阶段仅展示本地文件/路径 MVP，不实现云存储或静态文件服务。</p>
        </div>
        <div class="mt-5 grid gap-2 text-sm text-slate-300">
          <p>采集时间：{{ formatDateTime(selectedEvidence.collectedAt) }}</p>
          <p>来源 URL：<a v-if="selectedEvidence.sourceUrl" class="text-cyan-200" :href="selectedEvidence.sourceUrl" target="_blank" rel="noreferrer">{{ selectedEvidence.sourceUrl }}</a></p>
        </div>
      </div>
    </div>
  </section>
</template>
