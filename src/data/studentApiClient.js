import { getAuthToken } from './authApiClient.js';

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

export async function listStudentCourses(studentId) {
  return requestJson(`/student/courses${buildQuery({ studentId })}`);
}

export async function getStudentDashboard(studentId) {
  return requestJson(`/student/dashboard${buildQuery({ studentId })}`);
}

export async function getStudentCourseGroups(studentId) {
  return requestJson(`/student/course-groups${buildQuery({ studentId })}`);
}

export async function getStudentCourseGroup(studentId, groupId) {
  return requestJson(`/student/course-groups/${encodeURIComponent(groupId)}${buildQuery({ studentId })}`);
}

export async function getStudentAnalysis(studentId) {
  return requestJson(`/student/analysis${buildQuery({ studentId })}`);
}

export async function getStudentCourseGroupAnalysisOverview(studentId) {
  return requestJson(`/student/analysis/course-groups${buildQuery({ studentId })}`);
}

export async function getStudentCourseGroupAnalysis(studentId, groupId) {
  return requestJson(`/student/analysis/course-groups/${encodeURIComponent(groupId)}${buildQuery({ studentId })}`);
}

export async function generateStudentCourseGroupProfile(studentId, groupId) {
  return requestJson(`/student/analysis/course-groups/${encodeURIComponent(groupId)}/generate`, {
    method: 'POST',
    body: JSON.stringify({ studentId })
  });
}

export async function getStudentCourseAnalysis(studentId, courseId) {
  return requestJson(`/student/analysis/courses/${encodeURIComponent(courseId)}${buildQuery({ studentId })}`);
}

export async function generateStudentCourseProfile(studentId, courseId) {
  return requestJson(`/student/analysis/courses/${encodeURIComponent(courseId)}/generate`, {
    method: 'POST',
    body: JSON.stringify({ studentId })
  });
}

export async function listStudentCourseCatalog(studentId) {
  return requestJson(`/student/course-catalog${buildQuery({ studentId })}`);
}

export async function joinStudentCourse(studentId, courseId) {
  return requestJson('/student/courses/join', {
    method: 'POST',
    body: JSON.stringify({ studentId, courseId })
  });
}

export async function getStudentCourse(studentId, courseId) {
  return requestJson(`/student/courses/${encodeURIComponent(courseId)}${buildQuery({ studentId })}`);
}

export async function getStudentTask(studentId, taskId) {
  return requestJson(`/student/tasks/${encodeURIComponent(taskId)}${buildQuery({ studentId })}`);
}

export async function saveStudentAnswer(studentId, taskId, answer) {
  return requestJson(`/student/tasks/${encodeURIComponent(taskId)}/answers`, {
    method: 'POST',
    body: JSON.stringify({
      studentId,
      ...answer
    })
  });
}

export async function submitStudentTask(studentId, taskId) {
  return requestJson(`/student/tasks/${encodeURIComponent(taskId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ studentId })
  });
}

export async function streamStudentPracticeGenerate(courseId, request = {}, handlers = {}) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('Missing VITE_API_BASE_URL');

  const token = getAuthToken();
  const response = await fetch(`${apiBaseUrl}/student/analysis/courses/${encodeURIComponent(courseId)}/practice-generate-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `Request failed with ${response.status}`);
  }
  if (!response.body?.getReader) throw new Error('Streaming is not supported in this browser');

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
      if (parsed.event === 'operation') handlers.onOperation?.(parsed.data.operation);
      if (parsed.event === 'question') handlers.onQuestion?.(parsed.data.question);
      if (parsed.event === 'task') handlers.onTask?.(parsed.data.task);
      if (parsed.event === 'done') handlers.onDone?.(parsed.data);
      if (parsed.event === 'error') throw new Error(parsed.data.message || 'AI practice stream failed');
    }
  }
}

export async function streamStudentAiChat(request = {}, handlers = {}) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('Missing VITE_API_BASE_URL');

  const token = getAuthToken();
  const response = await fetch(`${apiBaseUrl}/student/ai/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `Request failed with ${response.status}`);
  }
  if (!response.body?.getReader) throw new Error('Streaming is not supported in this browser');

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
      if (parsed.event === 'done') handlers.onDone?.(parsed.data);
      if (parsed.event === 'error') throw new Error(parsed.data.message || 'AI chat stream failed');
    }
  }
}
