import axios from 'axios';

const api = axios.create({ baseURL: 'pacific-delight.railway.internal' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});


export const errMsg = (e) =>
  e?.response?.data?.message || e?.message || 'Xatolik yuz berdi';

export default api;
