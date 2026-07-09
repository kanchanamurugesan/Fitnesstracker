import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // { id, email } or null
  const [loading, setLoading] = useState(true);

  // On load, validate any stored token.
  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // A 401 anywhere logs the user out.
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const login = async (email, password) => {
    const { token, email: e } = await api.login(email, password);
    setToken(token);
    setUser({ email: e });
  };
  const signup = async (email, password) => {
    const { token, email: e } = await api.signup(email, password);
    setToken(token);
    setUser({ email: e });
  };
  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
