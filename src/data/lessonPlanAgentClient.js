function getApiBaseUrl() {
  if (globalThis.__EDUAI_API_BASE_URL__) return globalThis.__EDUAI_API_BASE_URL__;
  return import.meta.env?.VITE_API_BASE_URL || '';
}

function getContentText(value) {
  if (Array.isArray(value)) return value.join('\n');
  return String(value || '');
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeCardList(value, titleKey = 'title') {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { [titleKey]: item.trim(), content: '' };
      return {
        [titleKey]: String(item?.[titleKey] || item?.label || item?.name || '').trim(),
        content: String(item?.content || item?.value || item?.text || '').trim()
      };
    })
    .filter((item) => item[titleKey] || item.content);
}

export function extractLessonPlanJsonBlock(content) {
  const match = getContentText(content).match(/:::lesson-plan-json\s*([\s\S]*?)\s*:::/i);
  return match ? match[1].trim() : '';
}

function getJsonFenceBlock(content) {
  const match = getContentText(content).match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match ? match[1].trim() : '';
}

function findBalancedJsonObject(content) {
  const text = getContentText(content);
  const start = text.indexOf('{');
  if (start < 0) return '';

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return text.slice(start, index + 1).trim();
  }

  return '';
}

export function parseLessonPlanFromAiText(content) {
  const candidates = [
    extractLessonPlanJsonBlock(content),
    getJsonFenceBlock(content),
    findBalancedJsonObject(content)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return normalizeLessonPlanPayload(JSON.parse(candidate));
    } catch {
      // Try the next candidate; AI may include explanatory JSON examples.
    }
  }
  return null;
}

function getStructuredStartIndex(content) {
  const text = getContentText(content);
  const candidates = [
    text.search(/:::lesson-/i),
    text.search(/```(?:json)?/i),
    text.indexOf('{'),
    text.search(/^\s*"(?:version|meta|objectives|materials|focus|difficulties|steps|teacher|student|board|check)"\s*:/m)
  ].filter((index) => index >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

export function stripLessonPlanJsonBlock(content) {
  const text = getContentText(content)
    .replace(/:::lesson-plan-json\s*[\s\S]*?\s*:::/gi, '')
    .replace(/:::lesson-(meta|objectives|materials|focus|closing)\s*[\s\S]*?\s*:::/gi, '')
    .replace(/:::lesson-section-start\s*[\s\S]*?\s*:::lesson-section-end/gi, '')
    .trim();
  const parsed = parseLessonPlanFromAiText(text);
  if (!parsed) return text;
  const structuredStart = getStructuredStartIndex(text);
  return structuredStart >= 0 ? text.slice(0, structuredStart).trim() : '';
}

export function getLessonPlanAssistantText(content) {
  const text = stripLessonPlanJsonBlock(content);
  const structuredStart = getStructuredStartIndex(text);
  const cleaned = structuredStart >= 0 ? text.slice(0, structuredStart).trim() : text;
  return cleaned.replace(/^\s*已生成[：:]?\s*$/m, '已生成教案，正在同步到左侧页面。').trim();
}

export function normalizeLessonStep(raw = {}, index = 0) {
  const title = String(raw.title || raw.phase || '').trim();
  if (!title) {
    throw new Error(`lesson step ${index + 1} missing title`);
  }
  return {
    id: String(raw.id || `step-${index + 1}`).trim(),
    title,
    time: String(raw.time || raw.duration || '').trim(),
    intent: String(raw.intent || raw.goal || raw.description || '').trim(),
    teacher: normalizeList(raw.teacher || raw.teacherActivities || raw.teacherActivity),
    student: normalizeList(raw.student || raw.studentActivities || raw.studentActivity),
    board: String(raw.board || raw.blackboard || '').trim(),
    check: String(raw.check || raw.assessment || raw.observation || '').trim(),
    status: String(raw.status || 'done').trim()
  };
}

export function normalizeLessonPlanPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('lesson plan payload must be an object');
  }
  if (!Array.isArray(payload.steps) || payload.steps.length === 0) {
    throw new Error('lesson plan steps must contain at least one step');
  }

  return {
    version: String(payload.version || 'v1'),
    meta: {
      grade: String(payload.meta?.grade || payload.grade || '').trim(),
      subject: String(payload.meta?.subject || payload.subject || '').trim(),
      textbook: String(payload.meta?.textbook || payload.textbook || '').trim(),
      duration: String(payload.meta?.duration || payload.duration || '').trim()
    },
    objectives: normalizeCardList(payload.objectives || payload.goals),
    materials: normalizeCardList(payload.materials || payload.basis, 'label'),
    focus: normalizeList(payload.focus || payload.keyPoints),
    difficulties: normalizeList(payload.difficulties || payload.hardPoints),
    steps: payload.steps.map((step, index) => normalizeLessonStep(step, index)),
    closing: normalizeCardList(payload.closing || payload.next)
  };
}

function parseJsonBlock(block) {
  try {
    return JSON.parse(block);
  } catch {
    return null;
  }
}

export function createStreamingLessonPlanParser(initialBuffer = '') {
  let buffer = String(initialBuffer || '');

  function parseEvent(type, raw) {
    const payload = parseJsonBlock(raw);
    if (!payload) return null;
    if (type === 'meta') return { type, meta: payload };
    if (type === 'objectives') return { type, objectives: normalizeCardList(Array.isArray(payload) ? payload : payload.objectives) };
    if (type === 'materials') return { type, materials: normalizeCardList(Array.isArray(payload) ? payload : payload.materials, 'label') };
    if (type === 'focus') {
      return {
        type,
        focus: normalizeList(Array.isArray(payload) ? payload : payload.focus),
        difficulties: normalizeList(payload.difficulties || payload.hardPoints)
      };
    }
    if (type === 'closing') return { type, closing: normalizeCardList(Array.isArray(payload) ? payload : payload.closing) };
    if (type === 'section') return { type, section: normalizeLessonStep(payload) };
    if (type === 'lessonPlan') return { type, lessonPlan: normalizeLessonPlanPayload(payload) };
    return null;
  }

  return {
    push(chunk = '') {
      buffer += String(chunk || '');
      const events = [];
      const pattern = /:::lesson-(meta|objectives|materials|focus|closing)\s*([\s\S]*?)\s*:::|:::lesson-section-start\s*([\s\S]*?)\s*:::lesson-section-end|:::lesson-plan-json\s*([\s\S]*?)\s*:::/g;
      let lastEnd = 0;
      let match = pattern.exec(buffer);
      while (match) {
        const event = match[1]
          ? parseEvent(match[1], match[2].trim())
          : match[3]
            ? parseEvent('section', match[3].trim())
            : parseEvent('lessonPlan', match[4].trim());
        if (event) events.push(event);
        lastEnd = pattern.lastIndex;
        match = pattern.exec(buffer);
      }
      if (lastEnd > 0) buffer = buffer.slice(lastEnd);
      return events;
    },
    getBuffer() {
      return buffer;
    },
    reset(nextBuffer = '') {
      buffer = String(nextBuffer || '');
    }
  };
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

export async function streamLessonPlan(courseId, request = {}, handlers = {}) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('Missing VITE_API_BASE_URL');

  const response = await fetch(`${apiBaseUrl}/courses/${encodeURIComponent(courseId)}/lesson-plan/generate-stream`, {
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
      if (parsed.event === 'meta') handlers.onMeta?.(parsed.data.meta);
      if (parsed.event === 'objectives') handlers.onObjectives?.(parsed.data.objectives || []);
      if (parsed.event === 'materials') handlers.onMaterials?.(parsed.data.materials || []);
      if (parsed.event === 'focus') handlers.onFocus?.(parsed.data);
      if (parsed.event === 'section') handlers.onSection?.(parsed.data.section);
      if (parsed.event === 'closing') handlers.onClosing?.(parsed.data.closing || []);
      if (parsed.event === 'lessonPlan') handlers.onLessonPlan?.(parsed.data.lessonPlan);
      if (parsed.event === 'done') handlers.onDone?.(parsed.data);
      if (parsed.event === 'error') throw new Error(parsed.data.message || 'AI lesson plan stream failed');
    }
  }
}
