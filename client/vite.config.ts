import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Vercel 会从仓库根目录的 public/ 走 CDN；本地仍保留 client/dist。
    outDir: process.env.VERCEL ? '../public' : 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
