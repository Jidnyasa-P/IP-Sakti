import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole, Language } from '../types';
import {
  getSessionUser,
  verifySession,
  dummyRegister,
  dummyLogin,
  dummyLogout,
  dummyAddRole,
  dummySetActiveRole,
} from '../components/auth/authStorage';

// ---------------------------------------------------------------------------
// AuthContext — currently backed by dummy/local storage (see authStorage.ts).
// The public shape of this context (user, isAuthenticated, login, register,
// logout, addRole, setActiveRole) is designed to stay the same once real
// backend auth is wired in — only the implementations below should need to
// change to call the real /api/auth/* endpoints.
// ---------------------------------------------------------------------------

interface RegisterParams {
  name: string;
  email: string;
  password: string;
  roles: UserRole[];
  preferred_language?: Language;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => void;
  addRole: (role: UserRole) => Promise<void>;
  setActiveRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getSessionUser());
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // On mount, verify the cached session against the backend in the
  // background (catches an expired/invalid/tampered token) without
  // blocking the initial render, which still uses the synchronously
  // cached user for a fast, flash-free load.
  useEffect(() => {
    let cancelled = false;
    verifySession().then((freshUser) => {
      if (!cancelled) setUser(freshUser);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    try {
      const loggedInUser = await dummyLogin(email, password);
      setUser(loggedInUser);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const register = useCallback(async (params: RegisterParams) => {
    setAuthLoading(true);
    try {
      const newUser = await dummyRegister({
        name: params.name,
        email: params.email,
        password: params.password,
        preferred_language: params.preferred_language,
        roles: params.roles,
      });
      setUser(newUser);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    dummyLogout();
    setUser(null);
  }, []);

  const addRole = useCallback(async (role: UserRole) => {
    if (!user) return;
    const updated = await dummyAddRole(user.id, role);
    setUser(updated);
  }, [user]);

  const setActiveRole = useCallback(async (role: UserRole) => {
    if (!user) return;
    const updated = await dummySetActiveRole(user.id, role);
    setUser(updated);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authLoading,
        login,
        register,
        logout,
        addRole,
        setActiveRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
