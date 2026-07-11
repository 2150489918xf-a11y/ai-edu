import { cachedApiRequest, stableCacheKey } from './apiCache.js';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '';
const LEARNING_CACHE_NAMESPACE = 'learning';

async function requestJson(path) {
  if (!API_BASE_URL) return null;

  try {
    return await cachedApiRequest(
      LEARNING_CACHE_NAMESPACE,
      stableCacheKey({ baseUrl: API_BASE_URL, path }),
      async () => {
        const response = await fetch(`${API_BASE_URL}${path}`);
        if (!response.ok) return null;
        return response.json();
      }
    );
  } catch {
    return null;
  }
}

export async function fetchClassLearningAnalysis(classId) {
  const payload = await requestJson(`/learning/classes/${encodeURIComponent(classId)}/summary`);
  return payload?.data || null;
}

export async function fetchStudentProfile(studentId) {
  const payload = await requestJson(`/students/${encodeURIComponent(studentId)}/profile`);
  return payload?.data || null;
}

export async function fetchStudentProfileList(filters = {}) {
  const searchParams = new URLSearchParams();
  if (filters.className) searchParams.set('className', filters.className);
  if (filters.keyword) searchParams.set('keyword', filters.keyword);
  const query = searchParams.toString();
  const payload = await requestJson(`/students${query ? `?${query}` : ''}`);

  if (!payload?.data) return null;

  return {
    classes: payload.meta?.classes || ['全部班级'],
    students: payload.data
  };
}

export async function fetchParentLearningSummary(studentId) {
  const payload = await requestJson(`/students/${encodeURIComponent(studentId)}/parent-summary`);
  return payload?.data || null;
}
