import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { DEFAULT_BACKEND_URL } from './backend-url.js';

export default defineConfig(({ mode }) => {
  const { VITE_BACKEND } = loadEnv(mode, process.cwd(), 'VITE_');
  const target = (VITE_BACKEND || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': target,
        '/uploads': target,
        '/socket.io': { target, ws: true },
      },
    },
  };
});
