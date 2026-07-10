function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function stripMarkdownFences(value) {
  return String(value || '')
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export function extractMindMapBlock(content) {
  const text = stripMarkdownFences(content);
  const match = text.match(/:::mindmap\s*([\s\S]*?):::/i);
  return match ? match[1].trim() : '';
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

function normalizeMessages(messages = []) {
  return Array.isArray(messages)
    ? messages
      .filter((message) => ['teacher', 'user', 'ai', 'assistant'].includes(message.role) && (message.content || message.text))
      .map((message) => ({
        role: ['ai', 'assistant'].includes(message.role) ? 'assistant' : 'user',
        content: String(message.content || message.text)
      }))
    : [];
}

function buildSystemPrompt() {
  return [
    '你是教学思维导图生成智能体。',
    '你可以先用自然语言简要说明生成思路，然后必须追加一个 :::mindmap 特征块。',
    ':::mindmap 块内部必须是 Markmap 可渲染的完整 Markdown，必须以一级标题 # 开头。',
    '层级使用 #、##、###、####，内容要服务老师备课，覆盖核心概念、关系、易错点、教学建议。',
    ':::mindmap 块格式必须严格如下：',
    ':::mindmap',
    '# 主题',
    '## 一级分支',
    '### 二级分支',
    ':::',
    '不要把 :::mindmap 块放进代码块，不要输出 JSON。'
  ].join('\n');
}

function buildCoursePrompt({ course = {}, prompt = '', currentMarkdown = '' }) {
  return [
    `课程标题：${course.title || course.shortTitle || '当前课程'}`,
    `学段/年级：${course.grade || '未提供'}`,
    `学科：${course.subject || '未提供'}`,
    `课时：${course.duration || '未提供'}`,
    `教学目标：${course.goal || '未提供'}`,
    `课程说明：${course.description || '未提供'}`,
    `知识点：${Array.isArray(course.knowledge) ? course.knowledge.join('、') : '未提供'}`,
    '课程大纲：',
    JSON.stringify(course.outline || {}, null, 2),
    '当前思维导图 Markdown：',
    currentMarkdown || '# 待生成思维导图',
    `老师要求：${prompt || '请根据课程基础信息生成一版可用于备课的思维导图。'}`
  ].join('\n');
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

function resolveMarkdown(content, explicitMarkdown = '') {
  const markdown = extractMindMapBlock(content) || stripMarkdownFences(explicitMarkdown);
  if (!markdown.startsWith('#')) {
    throw createHttpError(502, 'AI_MINDMAP_PARSE_FAILED', 'AI 返回的导图不是可渲染的 Markdown');
  }
  return markdown;
}

export function createAiMindMapService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
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
          { role: 'user', content: buildCoursePrompt(request) },
          ...normalizeMessages(request.messages)
        ],
        temperature: 0.2
      })
    });
    const content = stripMarkdownFences(extractOpenAiText(payload));
    return {
      provider: 'openai',
      model,
      content,
      markdown: resolveMarkdown(content)
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
          { role: 'user', content: buildCoursePrompt(request) },
          ...normalizeMessages(request.messages)
        ],
        temperature: 0.2
      })
    });
    const content = stripMarkdownFences(payload.choices?.[0]?.message?.content || '');
    return {
      provider: 'deepseek',
      model,
      content,
      markdown: resolveMarkdown(content)
    };
  }

  return {
    async generateMindMap(request = {}) {
      if (env.OPENAI_API_KEY) return generateWithOpenAi(request);
      if (env.DEEPSEEK_API_KEY) return generateWithDeepSeek(request);
      throw createHttpError(
        500,
        'AI_CREDENTIALS_MISSING',
        'Missing OPENAI_API_KEY or DEEPSEEK_API_KEY'
      );
    }
  };
}
