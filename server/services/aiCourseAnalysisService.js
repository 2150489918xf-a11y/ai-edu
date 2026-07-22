function aiError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

const asArray = (value) => Array.isArray(value) ? value : [];

async function readProviderStream(response, onText) {
  if (!response.body?.getReader) throw aiError(502, 'AI_STREAM_UNAVAILABLE', 'AI 服务未返回流式响应');
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
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const payload = JSON.parse(data);
          const text = payload.choices?.[0]?.delta?.content || '';
          if (text) onText(text);
        } catch {
          // Ignore malformed provider frames without terminating a valid stream.
        }
      }
    }
  }
}

function parseReport(text) {
  const match = String(text).match(/:::course-analysis-report-start\s*([\s\S]*?)\s*:::course-analysis-report-end/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    return {
      summary: value.summary && typeof value.summary === 'object' ? value.summary : {},
      weakPoints: asArray(value.weakPoints),
      teachingSuggestions: asArray(value.teachingSuggestions),
      practiceSuggestions: value.practiceSuggestions && typeof value.practiceSuggestions === 'object' ? value.practiceSuggestions : {}
    };
  } catch {
    return null;
  }
}

function systemPrompt() {
  return [
    '你是高中教师的课程学情分析助手。所有客观数字必须严格使用输入统计，不得编造。',
    '请先用简体中文流式说明分析过程，最后输出一个完整结构化块。',
    '块必须使用 :::course-analysis-report-start 和 :::course-analysis-report-end 包围，中间只能有一个合法 JSON 对象。',
    'JSON 字段：summary（含 conclusions 数组与 overview 字符串）、weakPoints 数组、teachingSuggestions 数组、practiceSuggestions 对象。',
    'weakPoints 每项包含 name、evidence、impact、priority；建议必须可执行。'
  ].join('\n');
}

export function createAiCourseAnalysisService({ courseAnalysisService, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!courseAnalysisService) throw new Error('courseAnalysisService is required');
  if (!fetchImpl) throw new Error('fetch implementation is required');
  return {
    async streamReport(request = {}, handlers = {}) {
      if (!env.DEEPSEEK_API_KEY) throw aiError(500, 'AI_CREDENTIALS_MISSING', '缺少 DEEPSEEK_API_KEY');
      if (!request.courseId) throw aiError(400, 'BAD_REQUEST', '缺少 courseId');
      const filters = { classId: request.classId || undefined, sessionId: request.sessionId || undefined };
      const snapshot = await courseAnalysisService.getCourseAnalysis(request.courseId, filters);
      const model = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat';
      const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
      const userPrompt = [
        `课程：${snapshot.course.title}`,
        `学科与年级：${snapshot.course.subject} / ${snapshot.course.grade}`,
        `分析范围：${snapshot.scope.type}`,
        `教师补充要求：${request.prompt || '无'}`,
        '课程统计：', JSON.stringify(snapshot.summary, null, 2),
        '薄弱题（最多 20 道）：', JSON.stringify(snapshot.questionStats.filter((item) => item.answerCount).slice(0, 20), null, 2)
      ].join('\n');
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: true, temperature: 0.2, messages: [{ role: 'system', content: systemPrompt() }, { role: 'user', content: userPrompt }] })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw aiError(response.status, 'AI_PROVIDER_ERROR', payload.error?.message || 'DeepSeek 调用失败');
      }
      let rawText = '';
      await readProviderStream(response, (text) => { rawText += text; handlers.onDelta?.(text); });
      const structured = parseReport(rawText);
      if (!structured) throw aiError(502, 'AI_PARSE_FAILED', 'AI 未返回可解析的结构化学情报告');
      handlers.onSection?.(structured);
      const saved = await courseAnalysisService.saveReport(request.courseId, filters, { ...structured, source: snapshot.source, rawText, provider: 'deepseek', model });
      handlers.onReport?.(saved);
      handlers.onDone?.({ provider: 'deepseek', model, reportId: saved.id });
      return saved;
    }
  };
}
