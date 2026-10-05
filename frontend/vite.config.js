import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const target = process.env.VITE_BACKEND || 'https://pacific-delight.railway.internal';

export default defineConfig({
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
});
