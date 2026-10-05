export const backendUrl = (import.meta.env.VITE_BACKEND || '').replace(/\/+$/, '');
export const apiBaseUrl = `${backendUrl}/api`;

export const assetUrl = (path) =>
  path?.startsWith('/uploads/') ? `${backendUrl}${path}` : path;
