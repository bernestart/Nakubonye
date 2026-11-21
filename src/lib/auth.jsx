import { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Failsafe timeout to guarantee loading becomes false
    const timeout = setTimeout(() => setLoading(false), 3000);

    fetch(`${API_BASE_URL}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.user) {
          setUser(data.user); setProfile(data.user); return refreshProfile();
        } else {
          setUser(null); setProfile(null);
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      })
      .catch(err => {
        console.error("Auth fetch failed:", err);
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });
  }, [token]);

  const signIn = async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
      setToken(data.token); setUser(data.user); setProfile(data.user);
      await refreshProfile();
    }
    return data;
  };

  const signUp = async (email, password, name) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Signup failed');
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
      setToken(data.token); setUser(data.user); setProfile(data.user);
    }
    return data;
  };

  
  const verifyOtp = async (email, otp) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/email-otp/verify-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invalid code');
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
      setToken(data.token); setUser(data.user); setProfile(data.user);
    }
    return data;
  };

  const signOut = async () => {
    await fetch(`${API_BASE_URL}/api/auth/sign-out`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem('auth_token');
    setToken(null); setUser(null); setProfile(null);
  };

  const refreshProfile = async () => {
    const t = localStorage.getItem('auth_token');
    if (!t) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me`, { headers: { Authorization: `Bearer ${t}` } });
      const json = await res.json();
      if (json && json.data) { setProfile(p => ({ ...(p || {}), ...json.data })); return json.data; }
    } catch (e) { console.warn('refreshProfile failed', e); }
    return null;
  };

  const session = user ? { user, access_token: token } : null;

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, verifyOtp, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
