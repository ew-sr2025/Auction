import axios from 'axios';
const API = axios.create({
  baseURL: "https://railway.app"
});
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});


export const errMsg = (e) =>
  e?.response?.data?.message || e?.message || 'Xatolik yuz berdi';

export default api;
