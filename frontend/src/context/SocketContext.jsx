import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketCtx = createContext(null);
export const useSocket = () => useContext(SocketCtx);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io("https://pacific-delight.railway.internal", {
      auth: token ? { token } : {}
    });
    setSocket(s);
    return () => s.disconnect();
  }, [token]);

  return <SocketCtx.Provider value={socket}>{children}</SocketCtx.Provider>;
}
