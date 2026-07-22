import {
  createStreamingQuestionParser,
  getQuestionStreamInstructions,
  parseQuestionsFromAiText
} from '../../src/data/aiQuestionParser.js';

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

function buildSystemPrompt() {
  return [
    '你是服务高中教师的题目生成助手。',
    '你可以先用自然语言简短说明生成思路，然后必须追加一个 :::questions 结构化题目块。',
    ':::questions 块内部必须是 JSON，不要放进 Markdown 代码块。',
    'JSON 可以是数组，也可以是 { "questions": [...] }。',
    '每道题必须包含 title、type、stage、difficulty、options、answer、analysis、knowledge。',
    'options 必须是数组；非选择题可为空数组。knowledge 必须是字符串数组。',
    '题干、选项、答案和解析必须准确、可直接进入题库。',
    getQuestionStreamInstructions(),
    ':::questions',
    '[',
    '  {',
    '    "type": "单选题",',
    '    "stage": "课中",',
    '    "difficulty": "基础",',
    '    "title": "题干",',
    '    "options": ["A", "B", "C", "D"],',
    '    "answer": "正确答案",',
    '    "analysis": "解析",',
    '    "knowledge": ["知识点"]',
    '  }',
    ']',
    ':::'
  ].join('\n');
}

function buildUserPrompt({ bank = {}, prompt = '', analysis = {}, analysisContext = null, candidateQuestions = [], editingQuestion = null, mode = 'generate' }) {
  return [
    `题库：${bank.title || '当前题库'}`,
    `学科：${bank.subject || '未提供'}`,
    `年级：${bank.grade || '未提供'}`,
    `题库说明：${bank.description || '未提供'}`,
    `任务模式：${mode === 'edit' ? '修改已有候选题' : '生成新候选题'}`,
    `教师要求：${prompt || '生成适合当前题库的课堂检测题'}`,
    '引用学情：',
    JSON.stringify(analysis || {}, null, 2),
    '课程学情报告（来自服务端持久化报告，优先用于确定知识点、难度和题型）：',
    JSON.stringify(analysisContext || {}, null, 2),
    '当前候选题：',
    JSON.stringify(candidateQuestions || [], null, 2),
    '正在编辑的题目：',
    JSON.stringify(editingQuestion || null, null, 2),
    mode === 'edit'
      ? '如果正在编辑的题目不为空，只返回 1 道修改后的完整题目，用于替换原题。'
      : '如果是生成新候选题，请返回一组新的完整题目，避免和当前候选题重复。'
  ].join('\n');
}

function extractOpenAiText(payload = {}) {
  if (payload.output_text) return String(payload.output_text);
  const chunks = [];
  for (const output of payload.output || []) {
    for (const content of output.content || []) {
      if (content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      response.status || 502,
      'AI_PROVIDER_ERROR',
      payload.error?.message || payload.error || 'AI provider request failed',
      { providerStatus: response.status }
    );
  }
  return payload;
}

function emitDone(handlers, meta) {
  if (typeof handlers.onDone === 'function') handlers.onDone(meta);
}

function emitDelta(handlers, text) {
  if (text && typeof handlers.onDelta === 'function') handlers.onDelta(text);
}

function emitQuestion(handlers, question) {
  if (question && typeof handlers.onQuestion === 'function') handlers.onQuestion(question);
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

export function createAiQuestionService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) {
    throw new Error('fetch implementation is required');
  }

  async function generateWithOpenAi(request) {
    const model = env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4.1-mini';
    const payload = await requestJson(fetchImpl, env.OPENAI_BASE_URL || 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(request) },
          ...normalizeMessages(request.messages)
        ],
        temperature: 0.2
      })
    });
    const reply = extractOpenAiText(payload);
    return {
      provider: 'openai',
      model,
      reply,
      questions: parseQuestionsFromAiText(reply)
    };
  }

  async function generateWithDeepSeek(request) {
    const model = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat';
    const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const payload = await requestJson(fetchImpl, `${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(request) },
          ...normalizeMessages(request.messages)
        ],
        temperature: 0.2
      })
    });
    const reply = String(payload.choices?.[0]?.message?.content || '');
    return {
      provider: 'deepseek',
      model,
      reply,
      questions: parseQuestionsFromAiText(reply)
    };
  }

  async function streamWithDeepSeek(request, handlers = {}) {
    const model = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat';
    const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const parser = createStreamingQuestionParser();
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
      emitDelta(handlers, text);
      parser.push(text).forEach((question) => emitQuestion(handlers, question));
    });
    emitDone(handlers, { provider: 'deepseek', model });
  }

  async function streamWithOpenAi(request, handlers = {}) {
    const model = env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4.1-mini';
    const parser = createStreamingQuestionParser();
    const response = await fetchImpl(env.OPENAI_BASE_URL || 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: true,
        input: [
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
      const text = payload.delta || payload.text || payload.output_text || '';
      emitDelta(handlers, text);
      parser.push(text).forEach((question) => emitQuestion(handlers, question));
    });
    emitDone(handlers, { provider: 'openai', model });
  }

  return {
    async generateQuestions(request = {}) {
      if (env.OPENAI_API_KEY) return generateWithOpenAi(request);
      if (env.DEEPSEEK_API_KEY) return generateWithDeepSeek(request);
      throw createHttpError(
        500,
        'AI_CREDENTIALS_MISSING',
        'Missing OPENAI_API_KEY or DEEPSEEK_API_KEY'
      );
    },
    async streamQuestions(request = {}, handlers = {}) {
      if (env.OPENAI_API_KEY) return streamWithOpenAi(request, handlers);
      if (env.DEEPSEEK_API_KEY) return streamWithDeepSeek(request, handlers);
      throw createHttpError(
        500,
        'AI_CREDENTIALS_MISSING',
        'Missing OPENAI_API_KEY or DEEPSEEK_API_KEY'
      );
    }
  };
}
