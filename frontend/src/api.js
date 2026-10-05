import axios from 'axios';
import { apiBaseUrl } from './config.js';

const API = axios.create({
  baseURL: apiBaseUrl
});
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});


export const errMsg = (e) =>
  e?.response?.data?.message || e?.message || 'Xatolik yuz berdi';

export default API;
