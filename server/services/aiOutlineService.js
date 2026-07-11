function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function stripMarkdownFences(value) {
  return String(value || '')
    .replace(/^```(?:json|markdown|md)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function normalizeMessages(messages = []) {
  return Array.isArray(messages)
    ? messages
      .filter((message) => ['user', 'assistant', 'teacher', 'ai'].includes(message.role) && (message.content || message.text))
      .map((message) => ({
        role: ['assistant', 'ai'].includes(message.role) ? 'assistant' : 'user',
        content: String(message.content || message.text)
      }))
    : [];
}

function buildSystemPrompt() {
  return [
    'You are an AI assistant for high-school teachers creating and revising lesson outlines.',
    'Respond in Simplified Chinese.',
    'You may answer naturally, explain your reasoning, or ask for missing information.',
    'When the teacher asks you to generate, rewrite, supplement, or revise the outline, append exactly one structured block after the natural-language reply.',
    'The block format is:',
    ':::outline-json',
    '{ ...complete JSON... }',
    ':::',
    'Do not wrap the JSON block in Markdown fences.',
    'The JSON root must contain version, tags, and sections.',
    'tags may be strings or objects like { "text": "力与加速度", "tone": "success" }.',
    'sections must contain 3 to 6 teaching sections unless the teacher explicitly asks otherwise.',
    'Each section must contain id, phase, time, title, status, active, and cards.',
    'Each cards item must be { "label": "教师动作", "content": "具体内容", "tone": "default" }.',
    'tone must be one of default, focus, warning, success, muted.',
    'At most one section may have active=true.',
    'Keep the outline consistent with grade, subject, duration, and teaching goal.'
  ].join('\n');
}

function buildUserPrompt({ course = {}, currentOutline = null }) {
  return [
    `课程标题: ${course.title || course.shortTitle || '当前课程'}`,
    `学段: ${course.grade || '未提供'}`,
    `学科: ${course.subject || '未提供'}`,
    `课时时长: ${course.duration || '未提供'}`,
    `教学目标: ${course.goal || '未提供'}`,
    '当前结构化大纲 JSON:',
    JSON.stringify(currentOutline || {}, null, 2),
    '请结合后续完整会话处理老师请求。'
  ].join('\n');
}

export function createAiOutlineService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) {
    throw new Error('fetch implementation is required');
  }

  return {
    async generateOutlineReply(request = {}) {
      if (!env.DEEPSEEK_API_KEY) {
        throw createHttpError(500, 'AI_CREDENTIALS_MISSING', 'Missing DEEPSEEK_API_KEY');
      }

      const model = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat';
      const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw createHttpError(
          response.status,
          'AI_PROVIDER_ERROR',
          payload.error?.message || 'DeepSeek request failed'
        );
      }

      return {
        content: stripMarkdownFences(payload.choices?.[0]?.message?.content || ''),
        provider: 'deepseek',
        model
      };
    }
  };
}
