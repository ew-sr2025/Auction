export const backendUrl = (import.meta.env.VITE_BACKEND || '').replace(/\/+$/, '');

export const assetUrl = (path) =>
  path?.startsWith('/uploads/') ? `${backendUrl}${path}` : path;
