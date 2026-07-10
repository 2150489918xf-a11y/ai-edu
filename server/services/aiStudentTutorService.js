function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function buildSystemPrompt() {
  return [
    '你是学生学习助手。',
    '你的目标是引导学生理解题目，而不是直接替学生报答案。',
    '先用简短问题或步骤帮助学生定位知识点，再解释解题思路。',
    '如果学生明确卡住，可以给出下一步提示；只有在学生要求核对时才说明最终结论。',
    '回答要适合高中学生阅读，语气清楚、克制、鼓励独立思考。'
  ].join('\n');
}

function buildUserPrompt(request = {}) {
  const course = request.course || {};
  const question = request.question || {};
  return [
    '课程信息：',
    `课程：${course.title || '未提供'}`,
    `学科：${course.subject || '未提供'}`,
    `年级：${course.grade || '未提供'}`,
    '',
    '当前题目：',
    `题型：${question.type || '未提供'}`,
    `题干：${question.title || '未提供'}`,
    `选项：${Array.isArray(question.options) && question.options.length ? question.options.join('；') : '无'}`,
    `学生当前答案：${question.studentAnswer?.value || question.studentAnswer || '未作答'}`,
    '',
    '学生问题：',
    request.message || ''
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

export function createAiStudentTutorService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) throw new Error('fetch implementation is required');

  return {
    async streamChat(request = {}, handlers = {}) {
      if (!request.message || !String(request.message).trim()) {
        throw createHttpError(400, 'BAD_REQUEST', '缺少学生问题');
      }
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
          stream: true,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(request) }
          ],
          temperature: 0.25
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw createHttpError(response.status, 'AI_PROVIDER_ERROR', payload.error?.message || 'AI provider request failed');
      }

      await readProviderStream(response, (payload) => {
        const text = payload.choices?.[0]?.delta?.content || '';
        if (text) handlers.onDelta?.(text);
      });
      handlers.onDone?.({ provider: 'deepseek', model });
    }
  };
}
