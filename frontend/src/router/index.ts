import { createRouter, createWebHistory } from 'vue-router';

import HomePage from '@/pages/HomePage.vue';
import ResultsPage from '@/pages/ResultsPage.vue';
import TaskPage from '@/pages/TaskPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/tasks/:taskId?',
      name: 'task',
      component: TaskPage,
    },
    {
      path: '/results/:taskId?',
      name: 'results',
      component: ResultsPage,
    },
    {
      path: '/tasks/:taskId/results',
      name: 'task-results',
      component: ResultsPage,
    },
  ],
});
