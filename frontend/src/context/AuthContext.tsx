import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { User, UserRole, Language } from '../types';
import { getSessionUser, dummyRegister, dummyLogin, dummyLogout } from '../components/auth/authStorage';

// ---------------------------------------------------------------------------
// AuthContext — currently backed by dummy/local storage (see authStorage.ts).
// The public shape of this context (user, isAuthenticated, login, register,
// logout) is designed to stay the same once real backend auth is wired in —
// only the implementations inside login()/register()/logout() below should
// need to change to call the real /api/auth/* endpoints.
// ---------------------------------------------------------------------------

interface RegisterParams {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  preferred_language?: Language;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getSessionUser());
  const [authLoading, setAuthLoading] = useState<boolean>(false);

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
        role: params.role,
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authLoading,
        login,
        register,
        logout,
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
