import { cachedApiRequest, clearApiCacheNamespace, stableCacheKey } from './apiCache.js';

const KNOWLEDGE_CACHE_NAMESPACE = 'knowledge';

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
    KNOWLEDGE_CACHE_NAMESPACE,
    stableCacheKey({ baseUrl: getApiBaseUrl(), path }),
    () => requestJson(path),
    options
  );
}

export function clearKnowledgeApiCache() {
  clearApiCacheNamespace(KNOWLEDGE_CACHE_NAMESPACE);
}

export async function listKnowledgeCategories(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/knowledge-categories${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 100, total: 0 }
  };
}

export async function createKnowledgeCategory(category) {
  const payload = await requestJson('/knowledge-categories', {
    method: 'POST',
    body: JSON.stringify(category)
  });
  clearKnowledgeApiCache();
  return payload.data;
}

export async function updateKnowledgeCategory(categoryId, patch) {
  const payload = await requestJson(`/knowledge-categories/${encodeURIComponent(categoryId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  clearKnowledgeApiCache();
  return payload.data;
}

export async function archiveKnowledgeCategory(categoryId) {
  const payload = await requestJson(`/knowledge-categories/${encodeURIComponent(categoryId)}`, {
    method: 'DELETE'
  });
  clearKnowledgeApiCache();
  return payload.data;
}

export async function listKnowledgeMaterials(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/knowledge-materials${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function createKnowledgeMaterial(material) {
  const payload = await requestJson('/knowledge-materials', {
    method: 'POST',
    body: JSON.stringify(material)
  });
  clearKnowledgeApiCache();
  return payload.data;
}

export async function getKnowledgeMaterial(materialId, options = {}) {
  const payload = await cachedRequestJson(`/knowledge-materials/${encodeURIComponent(materialId)}`, options);
  return payload.data;
}

export async function updateKnowledgeMaterial(materialId, patch) {
  const payload = await requestJson(`/knowledge-materials/${encodeURIComponent(materialId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  clearKnowledgeApiCache();
  return payload.data;
}

export async function archiveKnowledgeMaterial(materialId) {
  const payload = await requestJson(`/knowledge-materials/${encodeURIComponent(materialId)}`, {
    method: 'DELETE'
  });
  clearKnowledgeApiCache();
  return payload.data;
}
