import { cachedApiRequest, clearApiCacheNamespace, stableCacheKey } from './apiCache.js';

const QUESTION_BANK_CACHE_NAMESPACE = 'question-bank';

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

function cachedRequestJson(path, options = {}) {
  return cachedApiRequest(
    QUESTION_BANK_CACHE_NAMESPACE,
    stableCacheKey({ baseUrl: getApiBaseUrl(), path }),
    () => requestJson(path),
    options
  );
}

export function clearQuestionBankApiCache() {
  clearApiCacheNamespace(QUESTION_BANK_CACHE_NAMESPACE);
}

export async function listQuestionBanks(filters = {}, options = {}) {
  const payload = await cachedRequestJson(`/question-banks${buildQuery(filters)}`, options);
  return {
    data: payload.data || [],
    pagination: payload.pagination || { page: 1, pageSize: 20, total: 0 }
  };
}

export async function getQuestionBank(bankId, options = {}) {
  const payload = await cachedRequestJson(`/question-banks/${encodeURIComponent(bankId)}`, options);
  return payload.data;
}

export async function createQuestionBank(bank) {
  const payload = await requestJson('/question-banks', {
    method: 'POST',
    body: JSON.stringify(bank)
  });
  clearQuestionBankApiCache();
  return payload.data;
}

export async function createQuestion(bankId, question) {
  const payload = await requestJson(`/question-banks/${encodeURIComponent(bankId)}/questions`, {
    method: 'POST',
    body: JSON.stringify(question)
  });
  clearQuestionBankApiCache();
  return payload.data;
}

export async function generateAiQuestions(bankId, request = {}) {
  const payload = await requestJson(`/question-banks/${encodeURIComponent(bankId)}/ai-generate`, {
    method: 'POST',
    body: JSON.stringify(request)
  });
  clearQuestionBankApiCache();
  return payload.data;
}

function parseSseFrame(frame) {
  const eventLine = frame.split(/\r?\n/).find((line) => line.startsWith('event:'));
  const dataLines = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'));
  if (!eventLine || !dataLines.length) return null;
  const event = eventLine.slice(6).trim();
  const rawData = dataLines.map((line) => line.slice(5).trim()).join('\n');
  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return null;
  }
}

export async function streamAiQuestions(bankId, request = {}, handlers = {}) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('Missing VITE_API_BASE_URL');

  const response = await fetch(`${apiBaseUrl}/question-banks/${encodeURIComponent(bankId)}/ai-generate-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `Request failed with ${response.status}`);
  }
  if (!response.body?.getReader) {
    throw new Error('Streaming is not supported in this browser');
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\n\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;
      if (parsed.event === 'delta') handlers.onDelta?.(parsed.data.text || '');
      if (parsed.event === 'question') handlers.onQuestion?.(parsed.data.question);
      if (parsed.event === 'done') handlers.onDone?.(parsed.data);
      if (parsed.event === 'error') throw new Error(parsed.data.message || 'AI stream failed');
    }
  }
  clearQuestionBankApiCache();
}

export async function updateQuestion(questionId, patch) {
  const payload = await requestJson(`/questions/${encodeURIComponent(questionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  clearQuestionBankApiCache();
  return payload.data;
}

export async function archiveQuestion(questionId) {
  const payload = await requestJson(`/questions/${encodeURIComponent(questionId)}`, {
    method: 'DELETE'
  });
  clearQuestionBankApiCache();
  return payload.data;
}

function questionBankPath(bankId) {
  return `/question-banks/${encodeURIComponent(bankId)}`;
}

export async function getQuestionBankKnowledgeGraph(bankId) {
  const payload = await cachedRequestJson(`${questionBankPath(bankId)}/knowledge-graph`);
  return payload.data;
}

export async function getQuestionBankKnowledgePoint(bankId, pointId) {
  const payload = await cachedRequestJson(`${questionBankPath(bankId)}/knowledge-points/${encodeURIComponent(pointId)}`);
  return payload.data;
}

export async function analyzePendingQuestionKnowledge(bankId) {
  const payload = await requestJson(`${questionBankPath(bankId)}/knowledge-graph/analyze-pending`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  clearQuestionBankApiCache();
  return payload.data;
}

export async function reconcileQuestionBankKnowledgeGraph(bankId) {
  const payload = await requestJson(`${questionBankPath(bankId)}/knowledge-graph/reconcile`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  clearQuestionBankApiCache();
  return payload.data;
}

export async function retryQuestionKnowledgeExtraction(questionId) {
  const payload = await requestJson(
    `/questions/${encodeURIComponent(questionId)}/knowledge-extraction/retry`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  clearQuestionBankApiCache();
  return payload.data;
}

export async function createQuestionBankKnowledgePoint(bankId, point) {
  const payload = await requestJson(`${questionBankPath(bankId)}/knowledge-points`, {
    method: 'POST',
    body: JSON.stringify(point)
  });
  clearQuestionBankApiCache();
  return payload.data;
}

export async function updateQuestionBankKnowledgePoint(bankId, pointId, patch) {
  const payload = await requestJson(
    `${questionBankPath(bankId)}/knowledge-points/${encodeURIComponent(pointId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  clearQuestionBankApiCache();
  return payload.data;
}

export async function mergeQuestionBankKnowledgePoint(bankId, pointId, request) {
  const payload = await requestJson(
    `${questionBankPath(bankId)}/knowledge-points/${encodeURIComponent(pointId)}/merge`,
    { method: 'POST', body: JSON.stringify(request) }
  );
  clearQuestionBankApiCache();
  return payload.data;
}

export async function removeQuestionBankKnowledgePoint(bankId, pointId, mode, request = {}) {
  const payload = await requestJson(
    `${questionBankPath(bankId)}/knowledge-points/${encodeURIComponent(pointId)}${buildQuery({ mode })}`,
    { method: 'DELETE', body: JSON.stringify(request) }
  );
  clearQuestionBankApiCache();
  return payload.data;
}

export async function createQuestionBankKnowledgeRelation(bankId, relation) {
  const payload = await requestJson(`${questionBankPath(bankId)}/knowledge-relations`, {
    method: 'POST',
    body: JSON.stringify(relation)
  });
  clearQuestionBankApiCache();
  return payload.data;
}

export async function updateQuestionBankKnowledgeRelation(bankId, relationId, patch) {
  const payload = await requestJson(
    `${questionBankPath(bankId)}/knowledge-relations/${encodeURIComponent(relationId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  clearQuestionBankApiCache();
  return payload.data;
}

export async function deleteQuestionBankKnowledgeRelation(bankId, relationId, request = {}) {
  const payload = await requestJson(
    `${questionBankPath(bankId)}/knowledge-relations/${encodeURIComponent(relationId)}`,
    { method: 'DELETE', body: JSON.stringify(request) }
  );
  clearQuestionBankApiCache();
  return payload.data;
}

export async function saveQuestionBankKnowledgeGraphLayout(bankId, request) {
  const payload = await requestJson(`${questionBankPath(bankId)}/knowledge-graph/layout`, {
    method: 'PUT',
    body: JSON.stringify(request)
  });
  clearQuestionBankApiCache();
  return payload.data;
}
