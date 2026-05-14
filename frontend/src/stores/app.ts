import { defineStore } from 'pinia';

import type { NavigationItem } from '@/types/navigation';

interface AppState {
  navigationItems: NavigationItem[];
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    navigationItems: [
      { label: '首页查询', path: '/' },
      { label: '任务执行', path: '/tasks' },
      { label: '结果列表', path: '/results' },
    ],
  }),
});
