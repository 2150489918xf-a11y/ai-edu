import { cachedApiRequest, clearAllApiCaches, clearApiCacheNamespace, stableCacheKey } from './apiCache.js';
import { getAuthToken } from './authApiClient.js';

const ADMIN_CACHE_NAMESPACE = 'admin';

function getApiBaseUrl() {
  if (globalThis.__EDUAI_API_BASE_URL__) return globalThis.__EDUAI_API_BASE_URL__;
  return import.meta.env?.VITE_API_BASE_URL || '';
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
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
  return payload;
}

function cachedRequestJson(path, options = {}) {
  return cachedApiRequest(
    ADMIN_CACHE_NAMESPACE,
    stableCacheKey({ baseUrl: getApiBaseUrl(), auth: Boolean(getAuthToken()), path }),
    () => requestJson(path),
    options
  );
}

export function clearAdminApiCache() {
  clearApiCacheNamespace(ADMIN_CACHE_NAMESPACE);
}

function clearAdminMutationCaches() {
  clearAdminApiCache();
  clearAllApiCaches();
}

export async function getAdminSummary(options = {}) {
  const payload = await cachedRequestJson('/admin/summary', options);
  return payload.data;
}

export async function listAdminTeachers(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/admin/teachers${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function createAdminTeacher(teacher) {
  const payload = await requestJson('/admin/teachers', {
    method: 'POST',
    body: JSON.stringify(teacher)
  });
  clearAdminMutationCaches();
  return payload.data;
}

export async function updateAdminTeacher(teacherId, patch) {
  const payload = await requestJson(`/admin/teachers/${encodeURIComponent(teacherId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  clearAdminMutationCaches();
  return payload.data;
}

export async function archiveAdminTeacher(teacherId) {
  const payload = await requestJson(`/admin/teachers/${encodeURIComponent(teacherId)}`, {
    method: 'DELETE'
  });
  clearAdminMutationCaches();
  return payload.data;
}

export async function listAdminStudents(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/students${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    meta: payload.meta || {},
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function listAdminClasses(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/classes${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function listAdminCourses(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/courses${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function getStudentEnrollments(studentId, options = {}) {
  const payload = await cachedRequestJson(`/admin/students/${encodeURIComponent(studentId)}/enrollments`, options);
  return payload.data;
}

export async function assignStudentCourse(studentId, courseId) {
  const payload = await requestJson(`/admin/students/${encodeURIComponent(studentId)}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ courseId })
  });
  clearAdminMutationCaches();
  return payload.data;
}

export async function removeStudentCourse(studentId, courseId) {
  const payload = await requestJson(`/admin/students/${encodeURIComponent(studentId)}/enrollments/${encodeURIComponent(courseId)}`, {
    method: 'DELETE'
  });
  clearAdminMutationCaches();
  return payload.data;
}
