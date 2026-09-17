// ---------------------------------------------------------------------------
// REAL BACKEND AUTH — calls /api/auth/* on the FastAPI backend.
//
// This file used to be dummy/local (localStorage-only) auth. Per its own
// original comment, it is the ONLY file that needed to change to wire up
// real authentication — every exported function keeps its original name
// and signature, so AuthContext.tsx and every UI component that consumes
// it needed no changes at all.
//
// Session persistence: the JWT is stored in localStorage (so a page reload
// doesn't log the user out) and the last-known user object is cached
// alongside it so getSessionUser() can stay synchronous (AuthContext calls
// it inside useState(() => getSessionUser()) during initial render, before
// any async call could resolve). AuthContext performs a background
// /api/auth/me refresh on mount to catch an expired/invalid token — see
// AuthContext.tsx's verifySession effect.
// ---------------------------------------------------------------------------
import { User, UserRole } from '../../types';

const TOKEN_KEY = 'ipsakti_auth_token';
const USER_CACHE_KEY = 'ipsakti_auth_user_cache';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeSession(token: string, user: User) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore storage quota/availability errors
  }
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Drop-in replacement for `fetch` that attaches the bearer token when one
 * exists. Safe to use for public endpoints too (e.g. /api/translate, used
 * before login) — it simply omits the header when there is no session. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || body.error || fallback;
  } catch {
    return fallback;
  }
}

export function getSessionUser(): User | null {
  if (!getAuthToken()) return null;
  return readCachedUser();
}

/** Best-effort background session check — call this once on app mount.
 * Refreshes the cached user (in case their profile/roles changed) and
 * clears the session if the token is no longer valid. Returns the fresh
 * user, or null if there is no session / it is no longer valid. */
export async function verifySession(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const user = (await res.json()) as User;
    writeSession(token, user);
    return user;
  } catch {
    // Network error: keep the cached session rather than logging the user
    // out just because the backend was briefly unreachable.
    return readCachedUser();
  }
}

export async function dummyRegister(params: {
  name: string;
  email: string;
  password: string;
  preferred_language?: string;
  roles: UserRole[];
}): Promise<User> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Registration failed. Please try again.'));
  }
  const { token, user } = await res.json();
  writeSession(token, user);
  return user;
}

export async function dummyLogin(email: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Invalid email or password.'));
  }
  const { token, user } = await res.json();
  writeSession(token, user);
  return user;
}

export function dummyLogout(): void {
  // Stateless JWT: no server-side session to invalidate. Fire-and-forget
  // the /api/auth/logout call (kept for symmetry / future server-side
  // token revocation) and clear the local session immediately either way.
  const token = getAuthToken();
  if (token) {
    fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  clearSession();
}

// `userId` is kept in the signature for backward compatibility with
// AuthContext.tsx's existing call sites; the backend identifies the user
// from the bearer token, not from this argument.
export async function dummyAddRole(_userId: string, role: UserRole): Promise<User> {
  const res = await authFetch('/api/auth/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Could not add role.'));
  }
  const user = await res.json();
  const token = getAuthToken();
  if (token) writeSession(token, user);
  return user;
}

export async function dummySetActiveRole(_userId: string, role: UserRole): Promise<User> {
  const res = await authFetch('/api/auth/active-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'This role is not available for this account.'));
  }
  const user = await res.json();
  const token = getAuthToken();
  if (token) writeSession(token, user);
  return user;
}
