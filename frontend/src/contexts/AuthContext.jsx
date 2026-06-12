import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearAuthToken, fetchCurrentUser, getAuthToken, setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      fetchCurrentUser()
        .then((user) => {
          if (mounted) {
            setCurrentUser(user);
          }
        })
        .catch(() => {
          clearAuthToken();
          if (mounted) {
            setCurrentUser(null);
          }
        })
        .finally(() => {
          if (mounted) {
            setIsLoading(false);
          }
        });
    } catch (error) {
      console.warn('Auth restore failed', error);
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, []);

  const login = (user, token) => {
    try {
      if (token) {
        setAuthToken(token);
      }
    } catch (error) {
      console.warn('Auth store failed', error);
    }
    if (user) {
      setCurrentUser(user);
    }
  };

  const updateUser = (user) => {
    if (user) {
      setCurrentUser((prev) => ({ ...prev, ...user }));
    }
  };

  const logout = () => {
    try {
      clearAuthToken();
    } catch (error) {
      console.warn('Auth cleanup failed', error);
    }
    setCurrentUser(null);
  };

  const value = useMemo(
    () => ({ currentUser, isLoading, login, logout, updateUser }),
    [currentUser, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
