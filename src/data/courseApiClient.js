import { cachedApiRequest, clearApiCacheNamespace, stableCacheKey } from './apiCache.js';

const COURSE_CACHE_NAMESPACE = 'course';

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
  if (!apiBaseUrl) {
    throw new Error('Missing VITE_API_BASE_URL');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    COURSE_CACHE_NAMESPACE,
    stableCacheKey({ baseUrl: getApiBaseUrl(), path }),
    () => requestJson(path),
    options
  );
}

export function clearCourseApiCache() {
  clearApiCacheNamespace(COURSE_CACHE_NAMESPACE);
}

export async function listCourses(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/courses${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function listCourseGroups(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/course-groups${buildQuery(filters)}`, options);
  return payload.data || [];
}

export async function createCourseGroup(group) {
  const payload = await requestJson('/course-groups', {
    method: 'POST',
    body: JSON.stringify(group)
  });
  clearCourseApiCache();
  return payload.data;
}

export async function deleteCourseGroup(groupId) {
  const payload = await requestJson(`/course-groups/${encodeURIComponent(groupId)}`, {
    method: 'DELETE'
  });
  clearCourseApiCache();
  return payload.data;
}

export async function createCourse(course) {
  const payload = await requestJson('/courses', {
    method: 'POST',
    body: JSON.stringify(course)
  });
  clearCourseApiCache();
  return payload.data;
}

export async function getCourse(courseId, options = {}) {
  const payload = await cachedRequestJson(`/courses/${encodeURIComponent(courseId)}`, options);
  return payload.data;
}

export async function updateCourse(courseId, patch) {
  const payload = await requestJson(`/courses/${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  clearCourseApiCache();
  return payload.data;
}

export async function generateCourseMindMap(courseId, request = {}) {
  const payload = await requestJson(`/courses/${encodeURIComponent(courseId)}/mindmap/generate`, {
    method: 'POST',
    body: JSON.stringify(request)
  });
  clearCourseApiCache();
  return payload.data;
}

export async function archiveCourse(courseId) {
  const payload = await requestJson(`/courses/${encodeURIComponent(courseId)}`, {
    method: 'DELETE'
  });
  clearCourseApiCache();
  return payload.data;
}

export async function deleteCoursePermanently(courseId) {
  const payload = await requestJson(`/courses/${encodeURIComponent(courseId)}/permanent`, {
    method: 'DELETE'
  });
  clearCourseApiCache();
  return payload.data;
}

export async function restoreCourse(courseId) {
  const payload = await requestJson(`/courses/${encodeURIComponent(courseId)}/restore`, {
    method: 'POST'
  });
  clearCourseApiCache();
  return payload.data;
}
