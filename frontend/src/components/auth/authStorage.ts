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

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
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
  role: UserRole;
}): Promise<User> {
  const email = params.email.trim().toLowerCase();
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === email)) {
    throw new Error('An account with this email already exists.');
  }

  const newUser: StoredUser = {
    id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: params.name.trim(),
    email,
    role: params.role,
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
