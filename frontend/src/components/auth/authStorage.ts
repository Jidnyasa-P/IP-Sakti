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

// The frontend is deployed as a separate static site from the backend (no
// dev-server proxy, no Vercel-style rewrite in production on Render), so a
// bare `fetch('/api/...')` resolves against the FRONTEND's own origin and
// 404s. VITE_API_BASE_URL (set in the frontend service's Render env vars —
// the backend's full https URL, e.g. https://ip-sakti-backend-dwox.onrender.com,
// NO trailing slash) is baked in at build time and prepended to every API
// call. Falls back to '' (same-origin, i.e. the old relative-path behavior)
// if it isn't set, so local dev via the Vite proxy still works untouched.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/** Prefixes a `/api/...` path with the backend's base URL. Use this for
 * every backend call — including ones that don't go through authFetch. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY) || sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

function writeSession(token: string, user: User, rememberMe = true) {
  try {
    const storage = rememberMe ? localStorage : sessionStorage;
    const other = rememberMe ? sessionStorage : localStorage;
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_CACHE_KEY);
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {}
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {}
}

export function getAuthToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); }
  catch { return null; }
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
  return fetch(apiUrl(input), { ...init, headers });
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
    const res = await fetch(apiUrl('/api/auth/me'), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const user = (await res.json()) as User;
    let rememberMe = true;
    try { rememberMe = !!localStorage.getItem(TOKEN_KEY); } catch {}
    writeSession(token, user, rememberMe);
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
  expert_type?: string;
}): Promise<{ success?: boolean; email?: string; token?: string; user?: User; email_verification?: { required: boolean; otp_sent: boolean } }> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Registration failed. Please try again.'));
  }
  const body = await res.json();
  return body;
}

export async function verifyEmail(email: string, otp: string): Promise<User> {
  const res = await fetch(apiUrl('/api/auth/verify-email'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Verification failed.'));
  const body = await res.json();
  return body.user as User;
}

export async function resendRegistrationOtp(email: string): Promise<void> {
  const res = await fetch(apiUrl('/api/auth/resend-otp'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not resend the verification code.'));
}

export async function requestForgotPassword(email: string): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(apiUrl('/api/auth/forgot-password/request'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Could not start password reset.'));
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The email service is taking longer than expected. Please wait a moment and try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function confirmForgotPassword(email: string, otp: string, newPassword: string): Promise<void> {
  const res = await fetch(apiUrl('/api/auth/forgot-password/confirm'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not reset your password.'));
}

export async function requestChangePassword(currentPassword: string): Promise<void> {
  const res = await authFetch('/api/auth/change-password/request', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not start password change.'));
}

export async function confirmChangePassword(otp: string, newPassword: string): Promise<void> {
  const res = await authFetch('/api/auth/change-password/confirm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not change your password.'));
}

export async function requestDeleteAccount(currentPassword: string): Promise<void> {
  const res = await authFetch('/api/auth/delete-account/request', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not start account deletion.'));
}

export async function confirmDeleteAccount(otp: string): Promise<void> {
  const res = await authFetch('/api/auth/delete-account/confirm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not delete your account.'));
  clearSession();
}

export async function dummyLogin(email: string, password: string, rememberMe = true): Promise<User> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Invalid email or password.'));
  }
  const { token, user } = await res.json();
  writeSession(token, user, rememberMe);
  return user;
}

export function dummyLogout(): void {
  // Stateless JWT: no server-side session to invalidate. Fire-and-forget
  // the /api/auth/logout call (kept for symmetry / future server-side
  // token revocation) and clear the local session immediately either way.
  const token = getAuthToken();
  if (token) {
    fetch(apiUrl('/api/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
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
  if (token) {
    let rememberMe = true;
    try { rememberMe = !!localStorage.getItem(TOKEN_KEY); } catch {}
    writeSession(token, user, rememberMe);
  }
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
  if (token) {
    let rememberMe = true;
    try { rememberMe = !!localStorage.getItem(TOKEN_KEY); } catch {}
    writeSession(token, user, rememberMe);
  }
  return user;
}
