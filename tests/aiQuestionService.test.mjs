import assert from 'node:assert/strict';

import { createAiQuestionService } from '../server/services/aiQuestionService.js';

function createJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

function createStreamResponse(chunks) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    }),
    async json() {
      return {};
    }
  };
}

const aiReply = [
  '已根据题库和学情生成 1 道题。',
  ':::questions',
  '[',
  '  {',
  '    "type": "单选题",',
  '    "stage": "课中",',
  '    "difficulty": "基础",',
  '    "title": "质量一定时，合外力增大到 2 倍，加速度如何变化？",',
  '    "options": ["增大到 2 倍", "减小到一半", "保持不变", "方向必定改变"],',
  '    "answer": "增大到 2 倍",',
  '    "analysis": "由 F=ma 可知，质量一定时加速度与合外力成正比。",',
  '    "knowledge": ["牛顿第二定律", "F=ma"]',
  '  }',
  ']',
  ':::'
].join('\n');

let capturedDeepSeekRequest;
const deepSeekService = createAiQuestionService({
  env: {
    DEEPSEEK_API_KEY: 'test-deepseek-key',
    DEEPSEEK_MODEL: 'deepseek-chat',
    DEEPSEEK_BASE_URL: 'https://deepseek.test'
  },
  fetchImpl: async (url, options) => {
    capturedDeepSeekRequest = { url, options, body: JSON.parse(options.body) };
    return createJsonResponse(200, {
      choices: [{ message: { content: aiReply } }]
    });
  }
});

const deepSeekResult = await deepSeekService.generateQuestions({
  bank: {
    id: 'newton-laws-bank',
    title: '牛顿第二定律题库',
    subject: '物理',
    grade: '高一',
    description: '课堂检测题库'
  },
  prompt: '生成一道考查 F=ma 的基础题',
  analysis: {
    title: '合外力和加速度方向',
    accuracy: 62,
    weakPoint: '忽略合外力方向'
  },
  messages: [{ role: 'teacher', text: '题目要短一点' }]
});

assert.equal(capturedDeepSeekRequest.url, 'https://deepseek.test/chat/completions');
assert.equal(capturedDeepSeekRequest.options.headers.Authorization, 'Bearer test-deepseek-key');
assert.equal(capturedDeepSeekRequest.body.model, 'deepseek-chat');
assert.ok(
  capturedDeepSeekRequest.body.messages.some((message) => message.content.includes(':::questions')),
  'system prompt should require structured question blocks'
);
assert.ok(
  capturedDeepSeekRequest.body.messages.some((message) => message.content.includes('牛顿第二定律题库')),
  'request should include question bank context'
);
assert.equal(deepSeekResult.provider, 'deepseek');
assert.equal(deepSeekResult.model, 'deepseek-chat');
assert.equal(deepSeekResult.reply, aiReply);
assert.equal(deepSeekResult.questions.length, 1);
assert.equal(deepSeekResult.questions[0].title, '质量一定时，合外力增大到 2 倍，加速度如何变化？');
assert.deepEqual(deepSeekResult.questions[0].knowledge, ['牛顿第二定律', 'F=ma']);

let capturedDeepSeekStreamRequest;
const deepSeekStreamService = createAiQuestionService({
  env: {
    DEEPSEEK_API_KEY: 'test-deepseek-key',
    DEEPSEEK_MODEL: 'deepseek-chat',
    DEEPSEEK_BASE_URL: 'https://deepseek.test'
  },
  fetchImpl: async (url, options) => {
    capturedDeepSeekStreamRequest = { url, body: JSON.parse(options.body) };
    return createStreamResponse([
      'data: {"choices":[{"delta":{"content":":::question-start\\n"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"Streamed service question\\",\\"options\\":[\\"A\\"],\\"answer\\":\\"A\\"}"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\n:::question-end"}}]}\n\n',
      'data: [DONE]\n\n'
    ]);
  }
});

const streamedEvents = [];
await deepSeekStreamService.streamQuestions(
  { bank: { title: 'Newton bank' }, prompt: 'stream question' },
  {
    onDelta: (text) => streamedEvents.push({ type: 'delta', text }),
    onQuestion: (question) => streamedEvents.push({ type: 'question', question }),
    onDone: (meta) => streamedEvents.push({ type: 'done', meta })
  }
);

assert.equal(capturedDeepSeekStreamRequest.body.stream, true);
assert.ok(
  capturedDeepSeekStreamRequest.body.messages.some((message) => message.content.includes(':::question-start')),
  'streaming system prompt should require per-question blocks'
);
assert.equal(streamedEvents.find((event) => event.type === 'question').question.title, 'Streamed service question');
assert.equal(streamedEvents.at(-1).type, 'done');

let capturedOpenAiRequest;
const openAiService = createAiQuestionService({
  env: {
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL: 'gpt-test'
  },
  fetchImpl: async (url, options) => {
    capturedOpenAiRequest = { url, options, body: JSON.parse(options.body) };
    return createJsonResponse(200, {
      output_text: aiReply
    });
  }
});

const openAiResult = await openAiService.generateQuestions({
  bank: { title: '牛顿题库', subject: '物理' },
  prompt: '生成题目'
});

assert.equal(capturedOpenAiRequest.url, 'https://api.openai.com/v1/responses');
assert.equal(capturedOpenAiRequest.options.headers.Authorization, 'Bearer test-openai-key');
assert.equal(capturedOpenAiRequest.body.model, 'gpt-test');
assert.equal(openAiResult.provider, 'openai');
assert.equal(openAiResult.questions.length, 1);

const missingKeyService = createAiQuestionService({
  env: {},
  fetchImpl: async () => {
    throw new Error('fetch should not be called without credentials');
  }
});

await assert.rejects(
  () => missingKeyService.generateQuestions({ bank: { title: '题库' }, prompt: '生成题目' }),
  /Missing OPENAI_API_KEY or DEEPSEEK_API_KEY/
);

console.log('AI question service contracts passed');
