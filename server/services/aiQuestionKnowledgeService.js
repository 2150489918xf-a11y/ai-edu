import { normalizeExtractionPayload, selectRelationCandidates } from './questionKnowledgeGraphDomain.js';

function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractJson(text) {
  const content = String(text || '').trim();
  const unfenced = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^:::question-knowledge\s*/i, '')
    .replace(/\s*:::$/i, '')
    .trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw createHttpError(502, 'AI_KNOWLEDGE_PARSE_ERROR', 'AI 未返回可解析的知识点 JSON');
  }
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch (cause) {
    throw createHttpError(502, 'AI_KNOWLEDGE_PARSE_ERROR', 'AI 知识点 JSON 格式错误', { cause: cause.message });
  }
}

function extractOpenAiText(payload = {}) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const parts = [];
  for (const item of normalizeArray(payload.output)) {
    for (const content of normalizeArray(item.content)) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

function extractionSystemPrompt() {
  return [
    '你是学生题目知识点提取服务，只负责分析单道题目。',
    '只输出一个 JSON 对象，不输出 Markdown 解释。',
    'JSON 必须包含 knowledgePoints 和 relations 两个数组。',
    'knowledgePoints 项包含 name、canonicalName、aliases、category、description、confidence。',
    'relations 项包含 source、target、type、label、confidence。',
    'type 仅使用 prerequisite、derivation、application、confusable、related。',
    '只提取题目真正考查的知识点，不根据题库名称虚构内容。'
  ].join('\n');
}

function relationSystemPrompt() {
  return [
    '你是题库知识点关系判断服务。',
    '输入只包含一个新增知识点和最多 20 个候选节点。',
    '只输出 JSON：{"knowledgePoints":[],"relations":[]}。',
    '只保留有明确教学含义的 prerequisite、derivation、application、confusable、related 关系。',
    '不确定时不输出关系，禁止为了连线而编造关系。'
  ].join('\n');
}

function extractionUserPrompt({ bank = {}, question = {} }) {
  return JSON.stringify({
    bank: {
      subject: bank.subject || '',
      grade: bank.grade || '',
      title: bank.title || ''
    },
    question: {
      id: question.id || '',
      title: question.title || '',
      options: normalizeArray(question.options),
      answer: question.answer ?? '',
      analysis: question.analysis || ''
    }
  });
}

function relationUserPrompt({ bank = {}, point = {}, candidates = [] }) {
  return JSON.stringify({
    bank: { subject: bank.subject || '', grade: bank.grade || '', title: bank.title || '' },
    point: {
      name: point.name || '',
      aliases: normalizeArray(point.aliases),
      category: point.category || '',
      description: point.description || ''
    },
    candidates: candidates.map((candidate) => ({
      name: candidate.name || '',
      aliases: normalizeArray(candidate.aliases),
      category: candidate.category || '',
      description: candidate.description || ''
    }))
  });
}

async function requestJson(fetchImpl, url, options) {
  if (typeof fetchImpl !== 'function') {
    throw createHttpError(500, 'AI_FETCH_UNAVAILABLE', 'AI 请求能力不可用');
  }
  const response = await fetchImpl(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      response.status || 502,
      'AI_PROVIDER_ERROR',
      payload.error?.message || 'AI provider request failed'
    );
  }
  return payload;
}

export function createAiQuestionKnowledgeService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  function providerConfig() {
    if (env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        model: env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4.1-mini'
      };
    }
    if (env.DEEPSEEK_API_KEY) {
      return {
        provider: 'deepseek',
        model: env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-chat'
      };
    }
    return null;
  }

  async function callProvider({ system, user }) {
    const config = providerConfig();
    if (!config) return { provider: 'local', model: '', content: '' };

    if (config.provider === 'openai') {
      const payload = await requestJson(fetchImpl, env.OPENAI_BASE_URL || 'https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          input: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0.1
        })
      });
      return { ...config, content: extractOpenAiText(payload) };
    }

    const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
    const payload = await requestJson(fetchImpl, `${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    return { ...config, content: payload.choices?.[0]?.message?.content || '' };
  }

  return {
    async extractQuestionKnowledge({ bank = {}, question = {} } = {}) {
      if (normalizeArray(question.knowledge).length) {
        return {
          provider: 'explicit',
          model: '',
          content: '',
          ...normalizeExtractionPayload({ knowledgePoints: question.knowledge, relations: [] })
        };
      }

      const called = await callProvider({
        system: extractionSystemPrompt(),
        user: extractionUserPrompt({ bank, question })
      });
      if (called.provider === 'local') {
        return { ...called, knowledgePoints: [], relations: [] };
      }
      return { ...called, ...normalizeExtractionPayload(extractJson(called.content)) };
    },

    async classifyKnowledgeRelations({ bank = {}, point = {}, candidates = [] } = {}) {
      const selected = selectRelationCandidates(point, candidates, 20);
      if (!selected.length) {
        return { provider: 'local', model: '', content: '', knowledgePoints: [], relations: [] };
      }
      const called = await callProvider({
        system: relationSystemPrompt(),
        user: relationUserPrompt({ bank, point, candidates: selected })
      });
      if (called.provider === 'local') {
        return { ...called, knowledgePoints: [], relations: [] };
      }
      return { ...called, ...normalizeExtractionPayload(extractJson(called.content)) };
    }
  };
}
