// ---------------------------------------------------------------------------
// DUMMY / LOCAL AUTH STORAGE — TEMPORARY.
//
// This file is the ONLY place that simulates a backend for auth. It stores a
// small "users table" and the current session in localStorage. When the real
// backend auth API is ready, this file is the only thing that should need to
// be rewritten (to call fetch('/api/auth/...') instead) — AuthContext.tsx and
// every UI component that consumes it should not need to change.
// ---------------------------------------------------------------------------
import { User, UserRole, Language } from '../../types';

const USERS_KEY = 'ipsakti_dummy_users';
const SESSION_KEY = 'ipsakti_dummy_session_user_id';

interface StoredUser extends User {
  password: string; // NEVER do this with a real backend — dummy/local only.
}

// Backward compatibility: accounts created before multi-role support only
// have a single `role` field and no `roles` array. Fill it in on read so
// nothing breaks for existing dummy/local sessions.
function migrateUser(u: StoredUser): StoredUser {
  if (!u.roles || !Array.isArray(u.roles) || u.roles.length === 0) {
    return { ...u, roles: [u.role] };
  }
  if (!u.roles.includes(u.role)) {
    return { ...u, roles: [...u.roles, u.role] };
  }
  return u;
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const users = raw ? (JSON.parse(raw) as StoredUser[]) : [];
    return users.map(migrateUser);
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore quota/storage errors in dummy mode
  }
}

function toPublicUser(u: StoredUser): User {
  const { password, ...publicUser } = u;
  return publicUser;
}

export function getSessionUser(): User | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const user = readUsers().find(u => u.id === id);
    return user ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export async function dummyRegister(params: {
  name: string;
  email: string;
  password: string;
  preferred_language?: Language;
  roles: UserRole[];
}): Promise<User> {
  const email = params.email.trim().toLowerCase();
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === email)) {
    throw new Error('An account with this email already exists.');
  }

  const roles = params.roles.length > 0 ? params.roles : ['Practitioner' as UserRole];

  const newUser: StoredUser = {
    id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: params.name.trim(),
    email,
    role: roles[0], // active role defaults to the first role selected at signup
    roles,
    preferred_language: params.preferred_language || 'en',
    created_at: new Date().toISOString(),
    password: params.password,
  };

  users.push(newUser);
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, newUser.id);
  return toPublicUser(newUser);
}

export async function dummyLogin(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();
  const match = users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!match || match.password !== password) {
    throw new Error('Invalid email or password.');
  }

  writeUsers(users); // persist any migration applied during readUsers()
  localStorage.setItem(SESSION_KEY, match.id);
  return toPublicUser(match);
}

export function dummyLogout(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// Add a new role to a user's role list (idempotent — no-op if already present).
export async function dummyAddRole(userId: string, role: UserRole): Promise<User> {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('User not found.');
  }

  const existing = users[idx];
  if (!existing.roles.includes(role)) {
    users[idx] = { ...existing, roles: [...existing.roles, role] };
  }

  writeUsers(users);
  return toPublicUser(users[idx]);
}

// Switch which of the user's existing roles is currently active.
export async function dummySetActiveRole(userId: string, role: UserRole): Promise<User> {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('User not found.');
  }

  const existing = users[idx];
  if (!existing.roles.includes(role)) {
    throw new Error('This role is not available for this account.');
  }

  users[idx] = { ...existing, role };
  writeUsers(users);
  return toPublicUser(users[idx]);
}
