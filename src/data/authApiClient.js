import { clearAllApiCaches } from './apiCache.js';

const TOKEN_KEY = 'eduai_auth_token';
const USER_KEY = 'eduai_auth_user';

function getApiBaseUrl() {
  if (globalThis.__EDUAI_API_BASE_URL__) return globalThis.__EDUAI_API_BASE_URL__;
  return import.meta.env?.VITE_API_BASE_URL || '';
}

function getStorage() {
  return globalThis.localStorage || null;
}

async function requestJson(path, options = {}) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('Missing VITE_API_BASE_URL');

  const token = getAuthToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `Request failed with ${response.status}`);
  }
  return payload.data;
}

export function getAuthToken() {
  return getStorage()?.getItem?.(TOKEN_KEY) || '';
}

export function getStoredAuthUser() {
  const raw = getStorage()?.getItem?.(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession(session) {
  const storage = getStorage();
  if (!storage) return;
  clearAllApiCaches();
  storage.setItem(TOKEN_KEY, session.token || '');
  storage.setItem(USER_KEY, JSON.stringify({ user: session.user, profile: session.profile }));
}

export function logout() {
  const storage = getStorage();
  clearAllApiCaches();
  if (!storage) return;
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
}

export async function login(credentials) {
  const data = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  setAuthSession(data);
  return data;
}

export async function getCurrentUser() {
  const data = await requestJson('/auth/me');
  const token = getAuthToken();
  if (token) setAuthSession({ ...data, token });
  return data;
}
