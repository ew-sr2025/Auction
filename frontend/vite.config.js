import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend porti .env dagi PORT bilan bir xil bo'lishi kerak.
// Boshqa port bo'lsa: VITE_BACKEND=http://localhost:4000 npm run dev
const target = process.env.VITE_BACKEND || 'http://localhost:5000';

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
