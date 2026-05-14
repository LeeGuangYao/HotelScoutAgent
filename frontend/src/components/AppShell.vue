<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const { navigationItems } = storeToRefs(appStore);
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 bg-slate-950/80">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <RouterLink class="text-lg font-semibold tracking-wide text-white" to="/">
          Hotel Scout Agent
        </RouterLink>
        <nav class="flex gap-2 text-sm text-slate-300" aria-label="主导航">
          <RouterLink
            v-for="item in navigationItems"
            :key="item.path"
            :to="item.path"
            class="rounded-full px-4 py-2 transition hover:bg-slate-800 hover:text-white"
            active-class="bg-cyan-500/15 text-cyan-200"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-10">
      <RouterView />
    </main>
  </div>
</template>
