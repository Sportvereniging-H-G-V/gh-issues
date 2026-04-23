import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'o4511269175099392',
      project: 'javascript-react',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
