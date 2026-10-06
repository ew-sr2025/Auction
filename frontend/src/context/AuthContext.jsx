import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const saveAuth = ({ token, user }) => {
    localStorage.setItem('token', token);
    setUser(user);
    setToken(token);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(logout)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    saveAuth(data);
  };

  const googleLogin = async (credential) => {
    const { data } = await api.post('/auth/google', { credential });
    saveAuth(data);
  };

  const register = async (payload, code) => {
    const { data } = await api.post('/auth/register/verify', { ...payload, code });
    saveAuth(data);
  };

  return (
    <AuthCtx.Provider
      value={{ user, token, loading, login, googleLogin, register, logout, updateUser: setUser }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
