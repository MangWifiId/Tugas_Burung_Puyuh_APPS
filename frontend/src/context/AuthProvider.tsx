import React, { useCallback, useEffect, useState } from 'react';
import type { User, Farm } from '../types';
import { api } from '../services/api';
import { AuthContext } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [farm, setFarm] = useState<Farm | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() =>
    Boolean(localStorage.getItem('token'))
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setFarm(null);
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const res = await api.get<{
        id: string;
        name: string;
        email: string;
        role: string;
        farm?: Farm;
      }>('/auth/me');
      setUser({
        id: res.id,
        name: res.name,
        email: res.email,
        role: res.role,
        farm_id: res.farm?.id,
      });
      if (res.farm) {
        setFarm(res.farm);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    // setIsLoading dipanggil setelah await, bukan sinkron di dalam effect.
    // oxlint-disable-next-line react/set-state-in-effect
    fetchProfile();
  }, [fetchProfile]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        farm,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
