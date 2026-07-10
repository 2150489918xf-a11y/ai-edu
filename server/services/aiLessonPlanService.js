import {
  createStreamingLessonPlanParser,
  normalizeLessonPlanPayload,
  parseLessonPlanFromAiText
} from '../../src/data/lessonPlanAgentClient.js';

function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function normalizeMessages(messages = []) {
  return Array.isArray(messages)
    ? messages
      .filter((message) => ['teacher', 'user', 'ai', 'assistant'].includes(message.role) && (message.text || message.content))
      .map((message) => ({
        role: ['ai', 'assistant'].includes(message.role) ? 'assistant' : 'user',
        content: String(message.text || message.content)
      }))
    : [];
}

function getLessonPlanStreamInstructions() {
  return [
    '流式生成时，请按模块输出结构化块。每个块必须是完整 JSON，不要放进 Markdown 代码块。',
    '先输出简短自然语言说明，再按顺序输出以下块：',
    '1. :::lesson-meta 到 :::，内容为 { "grade": "高一", "subject": "物理", "textbook": "教材", "duration": "45 分钟" }。',
    '2. :::lesson-objectives 到 :::，内容为数组，每项 { "title": "物理观念", "content": "目标内容" }。',
    '3. :::lesson-materials 到 :::，内容为数组，每项 { "label": "教材依据", "value": "依据内容" }。',
    '4. :::lesson-focus 到 :::，内容为 { "focus": ["重点"], "difficulties": ["难点"] }。',
    '5. 每个教学环节必须独立输出在 :::lesson-section-start 和 :::lesson-section-end 之间。',
    '每个教学环节 JSON 必须包含 id、title、time、intent、teacher、student、board、check。',
    'teacher 和 student 必须是字符串数组。',
    '6. :::lesson-closing 到 :::，内容为数组，每项 { "title": "课件联动", "content": "联动说明" }。',
    '最后必须追加 :::lesson-plan-json 完整块，内容是完整 JSON，顶层包含 version、meta、objectives、materials、focus、difficulties、steps、closing。',
    '不要强制四段式。请根据课程大纲、课时时长和教师要求生成适合的教学环节数量。'
  ].join('\n');
}

function buildSystemPrompt() {
  return [
    '你是高中教师的教案生成智能体。',
    '你需要基于课程基础信息、课程大纲、资料上下文和教师要求，生成可直接渲染到备课系统的结构化教案。',
    '你可以用自然语言简短解释生成思路，但结构化内容必须严格遵守协议。',
    '教案内容要具体、课堂可执行，避免泛泛而谈。',
    getLessonPlanStreamInstructions()
  ].join('\n');
}

function buildUserPrompt({ course = {}, prompt = '', currentLessonPlan = null }) {
  return [
    `课程标题：${course.title || course.shortTitle || '当前课程'}`,
    `学段：${course.grade || '未提供'}`,
    `学科：${course.subject || '未提供'}`,
    `课时时长：${course.duration || '未提供'}`,
    `教学目标：${course.goal || '未提供'}`,
    `教师要求：${prompt || '生成第一版完整教案'}`,
    '课程大纲 JSON：',
    JSON.stringify(course.outline || {}, null, 2),
    '知识点：',
    JSON.stringify(course.knowledge || [], null, 2),
    '当前教案 JSON：',
    JSON.stringify(currentLessonPlan || course.lessonPlan || null, null, 2),
    '请输出自然语言说明和结构化教案块。'
  ].join('\n');
}

async function readProviderStream(response, onPayload) {
  if (!response.body?.getReader) {
    throw createHttpError(502, 'AI_STREAM_UNAVAILABLE', 'AI provider did not return a readable stream');
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
      const lines = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'));
      for (const line of lines) {
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') return;
        try {
          onPayload(JSON.parse(data));
        } catch {
          // Ignore malformed provider frames and continue streaming.
        }
      }
    }
  }
}

function createAccumulator(course = {}) {
  return {
    version: 'v1',
    meta: {
      grade: course.grade || '',
      subject: course.subject || '',
      textbook: '',
      duration: course.duration || ''
    },
    objectives: [],
    materials: [],
    focus: [],
    difficulties: [],
    steps: [],
    closing: []
  };
}

function mergeEvent(accumulator, event) {
  if (event.type === 'meta') accumulator.meta = { ...accumulator.meta, ...event.meta };
  if (event.type === 'objectives') accumulator.objectives = event.objectives;
  if (event.type === 'materials') accumulator.materials = event.materials;
  if (event.type === 'focus') {
    accumulator.focus = event.focus || accumulator.focus;
    accumulator.difficulties = event.difficulties || accumulator.difficulties;
  }
  if (event.type === 'section') {
    const index = accumulator.steps.findIndex((step) => step.id === event.section.id);
    if (index >= 0) accumulator.steps.splice(index, 1, event.section);
    else accumulator.steps.push(event.section);
  }
  if (event.type === 'closing') accumulator.closing = event.closing;
}

export function createAiLessonPlanService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) {
    throw new Error('fetch implementation is required');
  }

  async function streamWithDeepSeek(request, handlers = {}) {
    const model = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat';
    const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const parser = createStreamingLessonPlanParser();
    const accumulator = createAccumulator(request.course);
    let finalLessonPlan = null;
    let rawReply = '';

    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(request) },
          ...normalizeMessages(request.messages)
        ],
        temperature: 0.2
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw createHttpError(response.status, 'AI_PROVIDER_ERROR', payload.error?.message || 'AI provider request failed');
    }

    await readProviderStream(response, (payload) => {
      const text = payload.choices?.[0]?.delta?.content || '';
      rawReply += text;
      if (text && typeof handlers.onDelta === 'function') handlers.onDelta(text);
      for (const event of parser.push(text)) {
        if (event.type === 'lessonPlan') {
          finalLessonPlan = event.lessonPlan;
          handlers.onLessonPlan?.(finalLessonPlan);
          continue;
        }
        mergeEvent(accumulator, event);
        if (event.type === 'meta') handlers.onMeta?.(event.meta);
        if (event.type === 'objectives') handlers.onObjectives?.(event.objectives);
        if (event.type === 'materials') handlers.onMaterials?.(event.materials);
        if (event.type === 'focus') handlers.onFocus?.({ focus: event.focus, difficulties: event.difficulties });
        if (event.type === 'section') handlers.onSection?.(event.section);
        if (event.type === 'closing') handlers.onClosing?.(event.closing);
      }
    });

    if (!finalLessonPlan) {
      finalLessonPlan = parseLessonPlanFromAiText(rawReply);
      if (finalLessonPlan) handlers.onLessonPlan?.(finalLessonPlan);
    }
    if (!finalLessonPlan && accumulator.steps.length) {
      finalLessonPlan = normalizeLessonPlanPayload(accumulator);
      handlers.onLessonPlan?.(finalLessonPlan);
    }
    handlers.onDone?.({ provider: 'deepseek', model });
  }

  return {
    async streamLessonPlan(request = {}, handlers = {}) {
      if (env.DEEPSEEK_API_KEY) return streamWithDeepSeek(request, handlers);
      throw createHttpError(500, 'AI_CREDENTIALS_MISSING', 'Missing DEEPSEEK_API_KEY');
    }
  };
}
