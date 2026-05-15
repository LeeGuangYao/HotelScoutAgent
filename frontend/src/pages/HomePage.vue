<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { createTask } from '@/api/tasks';
import type { PlatformCode, SearchCriteria, SortBy } from '@/types/task';

const router = useRouter();

const platformOptions: Array<{ label: string; value: PlatformCode }> = [
  { label: '携程', value: 'ctrip' },
  { label: 'Booking', value: 'booking' },
  { label: '飞猪', value: 'fliggy' },
  { label: '美团', value: 'meituan' },
];

const sortOptions: Array<{ label: string; value: SortBy }> = [
  { label: '价格优先', value: 'price' },
  { label: '可信度优先', value: 'trust' },
  { label: '距离优先', value: 'distance' },
];

const form = reactive({
  destination: '东京',
  checkInDate: '2026-06-01',
  checkOutDate: '2026-06-02',
  adults: 2,
  keywordsText: '新宿, 近地铁',
  priceMin: 0,
  priceMax: 500,
  distanceFilter: '距离市中心',
  platforms: ['ctrip'] as PlatformCode[],
  sortBy: 'price' as SortBy,
});

const isSubmitting = ref(false);
const errorMessage = ref('');

const canSubmit = computed(
  () => form.destination.trim().length > 0 && form.checkInDate < form.checkOutDate && form.platforms.length > 0,
);

const togglePlatform = (platform: PlatformCode): void => {
  if (form.platforms.includes(platform)) {
    form.platforms = form.platforms.filter((selected) => selected !== platform);
    return;
  }

  form.platforms = [...form.platforms, platform];
};

const buildCriteria = (): SearchCriteria => ({
  destination: form.destination.trim(),
  checkInDate: form.checkInDate,
  checkOutDate: form.checkOutDate,
  adults: Number(form.adults),
  keywords: form.keywordsText
    .split(/[,，\s]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean),
  priceMin: Number(form.priceMin),
  priceMax: Number(form.priceMax),
  distanceFilter: form.distanceFilter.trim() || undefined,
  platforms: form.platforms,
  sortBy: form.sortBy,
});

const submitSearch = async (): Promise<void> => {
  if (!canSubmit.value) {
    errorMessage.value = '请填写目的地、有效日期，并至少选择一个平台。';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const detail = await createTask(buildCriteria());
    await router.push({ name: 'task', params: { taskId: detail.task.id } });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '创建任务失败，请稍后重试。';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <section class="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">Search</p>
        <h1 class="mt-4 text-3xl font-bold text-white">酒店比价查询</h1>
        <p class="mt-4 max-w-2xl text-slate-300">
          输入目的地、日期、人数和筛选条件，创建本地单用户 MVP 采集任务。
        </p>
      </div>
      <div class="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
        当前阶段仅打通任务创建与任务页联调，不启动真实平台采集。
      </div>
    </div>

    <form class="mt-8 grid gap-5" @submit.prevent="submitSearch">
      <div class="grid gap-5 md:grid-cols-2">
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          目的地
          <input v-model="form.destination" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" placeholder="例如：东京" />
        </label>
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          人数
          <input v-model.number="form.adults" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" min="1" type="number" />
        </label>
      </div>

      <div class="grid gap-5 md:grid-cols-2">
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          入住日期
          <input v-model="form.checkInDate" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" type="date" />
        </label>
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          离店日期
          <input v-model="form.checkOutDate" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" type="date" />
        </label>
      </div>

      <div class="grid gap-5 md:grid-cols-3">
        <label class="grid gap-2 text-sm font-medium text-slate-200 md:col-span-1">
          关键词
          <input v-model="form.keywordsText" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" placeholder="新宿, 银座, 近地铁" />
        </label>
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          最低价
          <input v-model.number="form.priceMin" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" min="0" type="number" />
        </label>
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          最高价
          <input v-model.number="form.priceMax" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" min="0" type="number" />
        </label>
      </div>

      <div class="grid gap-5 md:grid-cols-2">
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          距离筛选
          <input v-model="form.distanceFilter" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" placeholder="距离市中心 / 地铁站 / 指定地点" />
        </label>
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          排序方式
          <select v-model="form.sortBy" class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300">
            <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>

      <div class="grid gap-3">
        <span class="text-sm font-medium text-slate-200">平台选择</span>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="platform in platformOptions"
            :key="platform.value"
            class="rounded-full border px-4 py-2 text-sm transition"
            :class="form.platforms.includes(platform.value) ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'"
            type="button"
            @click="togglePlatform(platform.value)"
          >
            {{ platform.label }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {{ errorMessage }}
      </p>

      <div class="flex justify-end">
        <button
          class="rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          :disabled="isSubmitting || !canSubmit"
          type="submit"
        >
          {{ isSubmitting ? '创建中…' : '创建查询任务' }}
        </button>
      </div>
    </form>
  </section>
</template>
