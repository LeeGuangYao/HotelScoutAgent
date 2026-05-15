import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3100',
      '/health': 'http://localhost:3100',
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
