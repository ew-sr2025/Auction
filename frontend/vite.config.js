import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const { VITE_BACKEND } = loadEnv(mode, process.cwd(), 'VITE_');
  const target = (VITE_BACKEND || 'http://localhost:5000').replace(/\/+$/, '');

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
