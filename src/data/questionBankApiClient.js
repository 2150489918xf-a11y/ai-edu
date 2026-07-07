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

export async function listQuestionBanks(filters = {}) {
  const payload = await requestJson(`/question-banks${buildQuery(filters)}`);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function getQuestionBank(bankId) {
  const payload = await requestJson(`/question-banks/${encodeURIComponent(bankId)}`);
  return payload.data;
}

export async function createQuestion(bankId, question) {
  const payload = await requestJson(`/question-banks/${encodeURIComponent(bankId)}/questions`, {
    method: 'POST',
    body: JSON.stringify(question)
  });
  return payload.data;
}

export async function updateQuestion(questionId, patch) {
  const payload = await requestJson(`/questions/${encodeURIComponent(questionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return payload.data;
}

export async function archiveQuestion(questionId) {
  const payload = await requestJson(`/questions/${encodeURIComponent(questionId)}`, {
    method: 'DELETE'
  });
  return payload.data;
}
