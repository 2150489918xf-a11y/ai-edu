import { cachedApiRequest, clearApiCacheNamespace, stableCacheKey } from './apiCache.js';

const NAMESPACE = 'course-analysis';
const baseUrl = () => globalThis.__EDUAI_API_BASE_URL__ || import.meta.env?.VITE_API_BASE_URL || '';

function query(filters = {}) {
  const params = new URLSearchParams();
  if (filters.classId) params.set('classId', filters.classId);
  if (filters.sessionId) params.set('sessionId', filters.sessionId);
  return params.size ? `?${params}` : '';
}

async function get(path, options = {}) {
  if (!baseUrl()) throw new Error('Missing VITE_API_BASE_URL');
  return cachedApiRequest(NAMESPACE, stableCacheKey({ baseUrl: baseUrl(), path }), async () => {
    const response = await fetch(`${baseUrl()}${path}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Request failed with ${response.status}`);
    return payload.data;
  }, options);
}

function parseFrame(frame) {
  const event = frame.split(/\r?\n/).find((line) => line.startsWith('event:'))?.slice(6).trim();
  const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
  if (!event || !data) return null;
  try { return { event, data: JSON.parse(data) }; } catch { return null; }
}

export const fetchCourseAnalysis = (courseId, filters = {}, options = {}) => get(`/courses/${encodeURIComponent(courseId)}/analysis${query(filters)}`, options);
export const fetchCourseQuestionDetail = (courseId, questionId, filters = {}, options = {}) => get(`/courses/${encodeURIComponent(courseId)}/analysis/questions/${encodeURIComponent(questionId)}${query(filters)}`, options);
export const fetchCourseAnalysisReportContext = (reportId, options = {}) => get(`/course-analysis-reports/${encodeURIComponent(reportId)}/context`, options);

export async function streamCourseAnalysisReport(courseId, request = {}, handlers = {}) {
  if (!baseUrl()) throw new Error('Missing VITE_API_BASE_URL');
  const response = await fetch(`${baseUrl()}/courses/${encodeURIComponent(courseId)}/analysis/reports/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `Request failed with ${response.status}`);
  }
  if (!response.body?.getReader) throw new Error('当前浏览器不支持流式响应');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\n\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const parsed = parseFrame(frame);
      if (!parsed) continue;
      if (parsed.event === 'delta') handlers.onDelta?.(parsed.data.text || '');
      if (parsed.event === 'section') handlers.onSection?.(parsed.data.section);
      if (parsed.event === 'report') handlers.onReport?.(parsed.data.report);
      if (parsed.event === 'done') handlers.onDone?.(parsed.data);
      if (parsed.event === 'error') throw new Error(parsed.data.message || 'AI 学情分析失败');
    }
  }
  clearApiCacheNamespace(NAMESPACE);
}

export function clearCourseAnalysisCache() {
  clearApiCacheNamespace(NAMESPACE);
}
