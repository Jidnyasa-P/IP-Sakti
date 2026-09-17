// ---------------------------------------------------------------------------
// THE ROOT CAUSE OF THE 401 STORM: this file was still the original fake,
// local-storage-only auth implementation. `components/auth/authStorage.ts`
// already had real backend calls (dummyLogin/dummyRegister/authFetch/a real
// JWT in localStorage) — but nothing here ever called it. login()/register()
// below just matched against a hardcoded SEEDED_INITIAL_USERS array (no
// password check, no backend call, no token ever issued), so
// getAuthToken() was always null and every authFetch()-wrapped request
// downstream (and any plain fetch()) got a 401, no matter how "logged in"
// the UI looked. Fixed by actually calling authStorage.ts here — this is
// the change authStorage.ts's own comment assumed had already happened.
//
// Exported interface (AuthContextType) is UNCHANGED — every component that
// calls useAuth() (LoginView, RegisterView, Header, ProfileView,
// LandingView, ExpertAdvisoryView) needed zero changes.
//
// Known, honest gaps (no backend endpoint exists for these yet — flagging
// rather than silently pretending they're wired up):
//   - updateProfile(): no PATCH /api/auth/me equivalent on the backend yet.
//     Kept as a local-only state update, same as before. A page reload that
//     re-runs verifySession() (GET /api/auth/me) will overwrite it with the
//     server's stored values, since the server never received the edit.
//   - removeRole(): no backend endpoint for removing a role. Local-only,
//     same caveat as updateProfile().
//   - organization / photo_url / expertCertificate: not fields on the
//     backend's User model (see backend/app/schemas/auth.py UserPublic) —
//     kept client-side-only on the cached user object, same caveat.
// ---------------------------------------------------------------------------
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, Language, normalizeRole, ExpertCertificate } from '../types';
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
}

export interface AuthContextType {
  currentUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  authLoading: boolean;
  login: (email: string, password?: string, expertCertificate?: ExpertCertificate) => Promise<{ success: boolean; user?: User; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'role' | 'roles' | 'preferred_language' | 'photo_url' | 'organization' | 'expertCertificate'>>) => Promise<void>;
  setActiveRole: (role: UserRole) => Promise<void>;
  addRole: (role: UserRole, certificate?: ExpertCertificate) => Promise<void>;
  removeRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Keep any client-only fields (not part of the backend's User model) when
 * merging a fresh server response over the previously-cached user. */
function mergeClientOnlyFields(serverUser: User, previous: User | null): User {
  if (!previous) return serverUser;
  return {
    ...serverUser,
    organization: serverUser.organization ?? previous.organization,
    photo_url: serverUser.photo_url ?? previous.photo_url,
    expertCertificate: serverUser.expertCertificate ?? previous.expertCertificate,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Synchronous initial value from the cached session (see authStorage.ts's
  // getSessionUser doc comment for why this must stay synchronous).
  const [currentUser, setCurrentUser] = useState<User | null>(() => getSessionUser());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Background session check on mount: confirms the cached token is still
  // valid (GET /api/auth/me) and refreshes the cached user; clears the
  // session if the token has expired or the user no longer exists.
  useEffect(() => {
    let cancelled = false;
    verifySession().then(user => {
      if (!cancelled) {
        setCurrentUser(prev => (user ? mergeClientOnlyFields(user, prev) : null));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (
    email: string,
    password?: string,
    expertCertificate?: ExpertCertificate,
  ): Promise<{ success: boolean; user?: User; error?: string }> => {
    setIsLoading(true);
    try {
      const user = await dummyLogin(email, password || '');
      const merged = expertCertificate ? { ...user, expertCertificate } : user;
      setCurrentUser(merged);
      return { success: true, user: merged };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Invalid email or password.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const roles = (data.roles && data.roles.length > 0)
        ? Array.from(new Set(data.roles.map(r => normalizeRole(r))))
        : [data.role ? normalizeRole(data.role) : ('Practitioner' as UserRole)];

      const user = await dummyRegister({
        name: data.name,
        email: data.email,
        password: data.password || '',
        preferred_language: data.preferred_language,
        roles,
      });

      // organization/photo_url/expertCertificate aren't persisted server-side
      // (see the file-level note above) — kept on the cached user anyway so
      // the UI that just collected them doesn't immediately lose them.
      const merged: User = {
        ...user,
        organization: data.organization,
        photo_url: data.photo_url,
        expertCertificate: data.expertCertificate,
      };
      setCurrentUser(merged);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Registration failed. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    dummyLogout();
    setCurrentUser(null);
  };

  const updateProfile = async (
    updates: Partial<Pick<User, 'name' | 'role' | 'roles' | 'preferred_language' | 'photo_url' | 'organization' | 'expertCertificate'>>,
  ) => {
    // No backend profile-update endpoint yet — see file-level note.
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, ...updates });
  };

  const setActiveRole = async (role: UserRole) => {
    if (!currentUser) return;
    try {
      const user = await dummySetActiveRole(currentUser.id, normalizeRole(role));
      setCurrentUser(prev => mergeClientOnlyFields(user, prev));
    } catch {
      // Keep the previous active role if the backend rejects the switch
      // (e.g. the account doesn't actually hold that role).
    }
  };

  const addRole = async (role: UserRole, certificate?: ExpertCertificate) => {
    if (!currentUser) return;
    try {
      const user = await dummyAddRole(currentUser.id, normalizeRole(role));
      setCurrentUser(prev => {
        const merged = mergeClientOnlyFields(user, prev);
        return certificate ? { ...merged, expertCertificate: certificate } : merged;
      });
    } catch {
      // Leave roles unchanged on failure; caller's UI should surface an error via its own try/catch if needed.
    }
  };

  const removeRole = async (role: UserRole) => {
    // No backend endpoint for removing a role yet — see file-level note.
    if (!currentUser) return;
    const normalized = normalizeRole(role);
    const existingRoles = currentUser.roles || [currentUser.role];
    if (existingRoles.length <= 1) return; // must keep at least one role
    const newRoles = existingRoles.filter(r => r !== normalized);
    const newActiveRole = currentUser.role === normalized ? newRoles[0] : currentUser.role;
    setCurrentUser({ ...currentUser, role: newActiveRole, roles: newRoles });
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
