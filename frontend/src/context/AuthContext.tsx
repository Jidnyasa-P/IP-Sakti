// ---------------------------------------------------------------------------
// REAL BACKEND AUTH
//
// Authentication is handled by components/auth/authStorage.ts.
// That module:
//   - calls POST /api/auth/login
//   - calls POST /api/auth/register
//   - stores the returned JWT in localStorage
//   - provides authFetch() for authenticated API requests
//   - verifies the JWT through GET /api/auth/me
//
// This context keeps the existing AuthContextType interface unchanged so
// existing UI components do not need to be modified.
//
// Known client-only fields:
//   - organization
//   - photo_url
//   - expertCertificate
//
// These are currently maintained locally because the backend User model does
// not expose profile-update endpoints for them.
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

import {
  User,
  UserRole,
  Language,
  normalizeRole,
  ExpertCertificate,
} from '../types';

import {
  dummyLogin,
  dummyRegister,
  dummyLogout,
  dummyAddRole,
  dummySetActiveRole,
  getSessionUser,
  verifySession,
} from '../components/auth/authStorage';

export interface RegisterData {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  roles?: UserRole[];
  preferred_language?: Language;
  photo_url?: string;
  organization?: string;
  expertCertificate?: ExpertCertificate;
  expert_type?: 'ayurveda' | 'legal' | 'regulatory';
}

export interface AuthContextType {
  currentUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  authLoading: boolean;

  login: (
    email: string,
    password?: string,
    expertCertificate?: ExpertCertificate,
    rememberMe?: boolean
  ) => Promise<{
    success: boolean;
    user?: User;
    error?: string;
  }>;

  register: (
    data: RegisterData
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;

  logout: () => void;

  updateProfile: (
    updates: Partial<
      Pick<
        User,
        | 'name'
        | 'role'
        | 'roles'
        | 'preferred_language'
        | 'photo_url'
        | 'organization'
        | 'expertCertificate'
      >
    >
  ) => Promise<void>;

  setActiveRole: (role: UserRole) => Promise<void>;

  addRole: (
    role: UserRole,
    certificate?: ExpertCertificate
  ) => Promise<void>;

  removeRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Preserve fields that currently exist only on the frontend when the
 * backend returns a refreshed User object.
 */
function mergeClientOnlyFields(
  serverUser: User,
  previous: User | null
): User {
  if (!previous) {
    return serverUser;
  }

  return {
    ...serverUser,

    organization:
      serverUser.organization ?? previous.organization,

    photo_url:
      serverUser.photo_url ?? previous.photo_url,

    expertCertificate:
      serverUser.expertCertificate ?? previous.expertCertificate,
  };
}

export const AuthProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  /*
   * Restore an existing JWT session synchronously when possible.
   *
   * getSessionUser() returns null when ipsakti_auth_token does not exist.
   */
  const [currentUser, setCurrentUser] = useState<User | null>(
    () => getSessionUser()
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);

  /*
   * Verify the stored JWT against the backend after the application mounts.
   *
   * If the token is valid:
   *   GET /api/auth/me → current user
   *
   * If invalid:
   *   authStorage clears the invalid session.
   */
  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const user = await verifySession();

      if (cancelled) {
        return;
      }

      setCurrentUser(previous =>
        user
          ? mergeClientOnlyFields(user, previous)
          : null
      );
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * REAL BACKEND LOGIN
   *
   * This calls:
   *   POST /api/auth/login
   *
   * dummyLogin() stores the returned JWT as:
   *   ipsakti_auth_token
   */
  const login = async (
    email: string,
    password?: string,
    expertCertificate?: ExpertCertificate,
    rememberMe = true
  ): Promise<{
    success: boolean;
    user?: User;
    error?: string;
  }> => {
    setIsLoading(true);

    try {
      if (!email.trim()) {
        return {
          success: false,
          error: 'Email is required.',
        };
      }

      if (!password) {
        return {
          success: false,
          error: 'Password is required.',
        };
      }

      /*
       * IMPORTANT:
       * dummyLogin() performs the actual backend request and stores
       * the JWT in localStorage.
       */
      const user = await dummyLogin(
        email.trim(),
        password,
        rememberMe
      );

      const mergedUser: User = expertCertificate
        ? {
            ...user,
            expertCertificate,
          }
        : user;

      setCurrentUser(mergedUser);

      return {
        success: true,
        user: mergedUser,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Invalid email or password.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * REAL BACKEND REGISTRATION
   *
   * This calls:
   *   POST /api/auth/register
   *
   * dummyRegister() stores the returned JWT automatically.
   */
  const register = async (
    data: RegisterData
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    setIsLoading(true);

    try {
      if (!data.name.trim()) {
        return {
          success: false,
          error: 'Name is required.',
        };
      }

      if (!data.email.trim()) {
        return {
          success: false,
          error: 'Email is required.',
        };
      }

      if (!data.password) {
        return {
          success: false,
          error: 'Password is required.',
        };
      }

      /*
       * Normalize and deduplicate roles before sending them to the backend.
       */
      const roles: UserRole[] =
        data.roles && data.roles.length > 0
          ? Array.from(
              new Set(
                data.roles.map(role =>
                  normalizeRole(role)
                )
              )
            )
          : [
              data.role
                ? normalizeRole(data.role)
                : ('Practitioner' as UserRole),
            ];

      /*
       * REAL BACKEND REGISTER
       */
      await dummyRegister({
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
        preferred_language: data.preferred_language || 'en',
        roles,
        expert_type: data.expert_type,
      });

      // Registration now requires email OTP verification before a session is created.
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Registration failed. Please try again.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout clears the JWT and cached user.
   */
  const logout = () => {
    dummyLogout();
    setCurrentUser(null);
  };

  /**
   * Currently client-side only because there is no backend profile
   * update endpoint.
   */
  const updateProfile = async (
    updates: Partial<
      Pick<
        User,
        | 'name'
        | 'role'
        | 'roles'
        | 'preferred_language'
        | 'photo_url'
        | 'organization'
        | 'expertCertificate'
      >
    >
  ) => {
    if (!currentUser) {
      return;
    }

    setCurrentUser({
      ...currentUser,
      ...updates,
    });
  };

  /**
   * Change active role through the real backend.
   */
  const setActiveRole = async (role: UserRole) => {
    if (!currentUser) {
      return;
    }

    try {
      const user = await dummySetActiveRole(
        currentUser.id,
        normalizeRole(role)
      );

      setCurrentUser(previous =>
        mergeClientOnlyFields(user, previous)
      );
    } catch {
      /*
       * Keep the existing role if the backend rejects the request.
       */
    }
  };

  /**
   * Add a role through the real backend.
   */
  const addRole = async (
    role: UserRole,
    certificate?: ExpertCertificate
  ) => {
    if (!currentUser) {
      return;
    }

    try {
      const user = await dummyAddRole(
        currentUser.id,
        normalizeRole(role)
      );

      setCurrentUser(previous => {
        const mergedUser = mergeClientOnlyFields(
          user,
          previous
        );

        return certificate
          ? {
              ...mergedUser,
              expertCertificate: certificate,
            }
          : mergedUser;
      });
    } catch {
      /*
       * Keep existing roles if the backend rejects the request.
       */
    }
  };

  /**
   * Role removal remains client-side because there is currently
   * no backend endpoint for removing a role.
   */
  const removeRole = async (role: UserRole) => {
    if (!currentUser) {
      return;
    }

    const normalizedRole = normalizeRole(role);

    const existingRoles =
      currentUser.roles || [currentUser.role];

    /*
     * Always keep at least one role.
     */
    if (existingRoles.length <= 1) {
      return;
    }

    const newRoles = existingRoles.filter(
      existingRole => existingRole !== normalizedRole
    );

    const newActiveRole =
      currentUser.role === normalizedRole
        ? newRoles[0]
        : currentUser.role;

    setCurrentUser({
      ...currentUser,
      role: newActiveRole,
      roles: newRoles,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn: currentUser !== null,
        isLoading,
        authLoading: isLoading,
        login,
        register,
        logout,
        updateProfile,
        setActiveRole,
        addRole,
        removeRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};