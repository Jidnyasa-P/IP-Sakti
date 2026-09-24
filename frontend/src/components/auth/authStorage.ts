// ---------------------------------------------------------------------------
// REAL BACKEND AUTH — calls /api/auth/* on the FastAPI backend.
//
// Session persistence:
// - "Remember me" checked: JWT is kept in localStorage and survives browser
//   restarts.
// - "Remember me" unchecked: JWT is kept in sessionStorage and is cleared
//   when the browser session ends.
// Passwords are never stored by the frontend.
// ---------------------------------------------------------------------------
import { User, UserRole } from '../../types';

const TOKEN_KEY = 'ipsakti_auth_token';
const USER_CACHE_KEY = 'ipsakti_auth_user_cache';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function getStorage(): Storage | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
      ? localStorage
      : sessionStorage.getItem(TOKEN_KEY)
        ? sessionStorage
        : null;
  } catch {
    return null;
  }
}

function readCachedUser(): User | null {
  try {
    const storage = getStorage();
    const raw = storage?.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeSession(token: string, user: User, rememberMe = true) {
  try {
    const persistentStorage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;

    otherStorage.removeItem(TOKEN_KEY);
    otherStorage.removeItem(USER_CACHE_KEY);

    persistentStorage.setItem(TOKEN_KEY, token);
    persistentStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore storage quota/availability errors
  }
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function getAuthToken(): string | null {
  try {
    return getStorage()?.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

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

export async function verifySession(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(apiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const user = (await res.json()) as User;
    const storage = getStorage();
    const rememberMe = storage === localStorage;
    writeSession(token, user, rememberMe);
    return user;
  } catch {
    // Keep the cached session if the backend is temporarily unreachable.
    return readCachedUser();
  }
}

export async function dummyRegister(params: {
  name: string;
  email: string;
  password: string;
  preferred_language?: string;
  roles: UserRole[];
  expert_type?: 'ayurveda' | 'legal' | 'regulatory';
}): Promise<{ requires_verification: boolean; user: User }> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Registration failed. Please try again.'));
  }

  const data = await res.json();
  return data as { requires_verification: boolean; user: User };
}

export async function verifyRegistrationEmail(email: string, otp: string): Promise<User> {
  const res = await fetch(apiUrl('/api/auth/verify-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Email verification failed.'));
  const data = await res.json();
  return data.user as User;
}

export async function resendRegistrationOtp(email: string): Promise<void> {
  const res = await fetch(apiUrl('/api/auth/resend-registration-otp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not resend OTP.'));
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(apiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not start password recovery.'));
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
  const res = await fetch(apiUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not reset password.'));
}

export async function sendChangePasswordOtp(): Promise<void> {
  const res = await authFetch('/api/auth/change-password/send-otp', { method: 'POST' });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not send password OTP.'));
}

export async function changePassword(currentPassword: string, otp: string, newPassword: string): Promise<void> {
  const res = await authFetch('/api/auth/change-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, otp, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not change password.'));
}

export async function deleteAccount(password: string, otp: string): Promise<void> {
  const res = await authFetch('/api/auth/account', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, otp }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not delete account.'));
  clearSession();
}

export async function dummyLogin(
  email: string,
  password: string,
  rememberMe = true
): Promise<User> {
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
  const token = getAuthToken();

  if (token) {
    fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  clearSession();
}

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
  if (token) writeSession(token, user, getStorage() === localStorage);
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
  if (token) writeSession(token, user, getStorage() === localStorage);
  return user;
}
