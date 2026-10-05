import { DEFAULT_BACKEND_URL } from '../backend-url.js';

export const backendUrl = (import.meta.env.VITE_BACKEND || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
export const apiBaseUrl = `${backendUrl}/api`;

export const assetUrl = (path) =>
  path?.startsWith('/uploads/') ? `${backendUrl}${path}` : path;
