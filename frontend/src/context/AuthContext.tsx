import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, Language, normalizeRole, ALL_ROLES, ExpertCertificate } from '../types';

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

const STORAGE_USERS_KEY = 'ipsakti_auth_users_v2';
const STORAGE_CURRENT_USER_KEY = 'ipsakti_auth_current_user_v2';

export const SEEDED_INITIAL_USERS: User[] = [
  {
    id: 'user-expert-aarav',
    name: 'Dr. Aarav Sharma',
    email: 'aarav.sharma@ayush-research.in',
    role: 'Expert',
    roles: ['Expert'],
    organization: 'Supreme Court & Patent Bar Association',
    preferred_language: 'en',
    created_at: '2025-01-15T09:30:00.000Z',
    expertCertificate: {
      fileName: 'CGPDTM_Patent_Agent_Certificate_IN_PA_3842.pdf',
      fileSize: 428000,
      fileType: 'application/pdf',
      certificateId: 'IN/PA/3842',
      certificateType: 'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
      issuingAuthority: 'CGPDTM, Ministry of Commerce and Industry, Govt of India',
      uploadedAt: '2025-01-15T09:30:00.000Z',
      status: 'Verified'
    }
  },
  {
    id: 'user-practitioner-radhika',
    name: 'Vaidya Radhika Sen',
    email: 'radhika.sen@ayurveda-clinic.in',
    role: 'Practitioner',
    roles: ['Practitioner'],
    organization: 'AyurMed Chikitsalaya & Research, Pune',
    preferred_language: 'en',
    created_at: '2025-02-10T10:00:00.000Z'
  },
  {
    id: 'user-researcher-vikram',
    name: 'Dr. Vikramaditya Joshi',
    email: 'v.joshi@bioayush-research.in',
    role: 'Researcher',
    roles: ['Researcher'],
    organization: 'Centre for Ethnobotanical Phytochemistry, Bangalore',
    preferred_language: 'en',
    created_at: '2025-02-12T11:00:00.000Z'
  },
  {
    id: 'user-org-himalayan',
    name: 'Himalayan Bio-Wellness Ltd',
    email: 'ipr@himalayanbiowellness.in',
    role: 'Organization',
    roles: ['Organization'],
    organization: 'AYUSH GMP Certified Manufacturer, Dehradun',
    preferred_language: 'en',
    created_at: '2025-02-15T14:00:00.000Z'
  },
  {
    id: 'user-admin-suresh',
    name: 'Suresh Kumar',
    email: 'admin@ipsakti.gov.in',
    role: 'Admin',
    roles: ['Admin'],
    organization: 'Ministry of Ayush / CGPDTM System Administration',
    preferred_language: 'en',
    created_at: '2025-01-01T00:00:00.000Z'
  }
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_USERS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const mapped = parsed.map((u: any) => ({
              ...u,
              role: normalizeRole(u.role),
              roles: Array.isArray(u.roles) && u.roles.length > 0
                ? Array.from(new Set(u.roles.map((r: any) => normalizeRole(r))))
                : [normalizeRole(u.role)]
            }));
            // Ensure seeded accounts exist
            const existingEmails = new Set(mapped.map((u: User) => u.email.toLowerCase()));
            const missingSeed = SEEDED_INITIAL_USERS.filter(s => !existingEmails.has(s.email.toLowerCase()));
            return [...mapped, ...missingSeed];
          }
        }
      } catch (e) {
        console.warn('Failed to load stored auth users:', e);
      }
    }
    return SEEDED_INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const activeRole = normalizeRole(parsed.role);
          const activeRoles = Array.isArray(parsed.roles) && parsed.roles.length > 0
            ? Array.from(new Set(parsed.roles.map((r: any) => normalizeRole(r))))
            : [activeRole];
          return {
            ...parsed,
            role: activeRole,
            roles: activeRoles
          };
        }
      } catch (e) {
        console.warn('Failed to load stored current user:', e);
      }
    }
    // Unauthenticated by default so user begins on Landing Page
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync users to localStorage whenever updated
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
      } catch (e) {}
    }
  }, [users]);

  // Sync currentUser to localStorage whenever updated
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (currentUser) {
          localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(currentUser));
        } else {
          localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
        }
      } catch (e) {}
    }
  }, [currentUser]);

  const login = async (email: string, _password?: string, expertCertificate?: ExpertCertificate): Promise<{ success: boolean; user?: User; error?: string }> => {
    setIsLoading(true);
    // Simulate brief asynchronous authentication delay
    await new Promise(resolve => setTimeout(resolve, 250));

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setIsLoading(false);
      return { success: false, error: 'Email address is required.' };
    }

    const matchedUser = users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (!matchedUser) {
      setIsLoading(false);
      return { success: false, error: 'No account found with this email. Please check your credentials or register.' };
    }

    const updatedMatchedUser = expertCertificate
      ? { ...matchedUser, expertCertificate }
      : matchedUser;

    if (expertCertificate) {
      setUsers(prev => prev.map(u => u.id === matchedUser.id ? updatedMatchedUser : u));
    }

    setCurrentUser(updatedMatchedUser);
    setIsLoading(false);
    return { success: true, user: updatedMatchedUser };
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedName = data.name.trim();

    if (!normalizedName) {
      setIsLoading(false);
      return { success: false, error: 'Full name is required.' };
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setIsLoading(false);
      return { success: false, error: 'A valid email address is required.' };
    }

    const existing = users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      setIsLoading(false);
      return { success: false, error: 'An account with this email address already exists. Please login instead.' };
    }

    const rawRoles = (data.roles && data.roles.length > 0)
      ? data.roles.map(r => normalizeRole(r))
      : [data.role ? normalizeRole(data.role) : 'Practitioner'];

    const userRoles = Array.from(new Set(rawRoles)) as UserRole[];
    const activeRole = data.role && userRoles.includes(normalizeRole(data.role))
      ? normalizeRole(data.role)
      : userRoles[0];

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: normalizedName,
      email: normalizedEmail,
      role: activeRole,
      roles: userRoles,
      organization: data.organization,
      preferred_language: data.preferred_language || 'en',
      photo_url: data.photo_url,
      expertCertificate: data.expertCertificate,
      created_at: new Date().toISOString()
    };

    setUsers(prev => [newUser, ...prev]);
    setCurrentUser(newUser);
    setIsLoading(false);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      } catch (e) {}
    }
  };

  const updateProfile = async (updates: Partial<Pick<User, 'name' | 'role' | 'roles' | 'preferred_language' | 'photo_url' | 'organization' | 'expertCertificate'>>) => {
    if (!currentUser) return;
    const nextRoles = updates.roles
      ? Array.from(new Set(updates.roles.map(r => normalizeRole(r))))
      : currentUser.roles || [currentUser.role];

    const nextRole = updates.role
      ? normalizeRole(updates.role)
      : currentUser.role;

    const updatedUser: User = {
      ...currentUser,
      ...updates,
      role: nextRole,
      roles: nextRoles
    };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
  };

  const setActiveRole = async (role: UserRole) => {
    if (!currentUser) return;
    const normalized = normalizeRole(role);
    const existingRoles = currentUser.roles || [currentUser.role];
    const newRoles = existingRoles.includes(normalized) ? existingRoles : [...existingRoles, normalized];
    const updatedUser: User = {
      ...currentUser,
      role: normalized,
      roles: newRoles
    };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
  };

  const addRole = async (role: UserRole, certificate?: ExpertCertificate) => {
    if (!currentUser) return;
    const normalized = normalizeRole(role);
    const existingRoles = currentUser.roles || [currentUser.role];
    const newRoles = existingRoles.includes(normalized) ? existingRoles : [...existingRoles, normalized];
    const updatedUser: User = {
      ...currentUser,
      roles: newRoles,
      expertCertificate: certificate || currentUser.expertCertificate
    };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
  };

  const removeRole = async (role: UserRole) => {
    if (!currentUser) return;
    const normalized = normalizeRole(role);
    const existingRoles = currentUser.roles || [currentUser.role];
    if (existingRoles.length <= 1) return; // Must keep at least one role
    const newRoles = existingRoles.filter(r => r !== normalized);
    const newActiveRole = currentUser.role === normalized ? newRoles[0] : currentUser.role;
    const updatedUser: User = {
      ...currentUser,
      role: newActiveRole,
      roles: newRoles
    };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
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
        removeRole
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
