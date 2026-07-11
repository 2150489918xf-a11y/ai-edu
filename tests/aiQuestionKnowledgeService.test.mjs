import assert from 'node:assert/strict';

import { createAiQuestionKnowledgeService } from '../server/services/aiQuestionKnowledgeService.js';

const calls = [];
const service = createAiQuestionKnowledgeService({
  env: {
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_MODEL: 'deepseek-test',
    DEEPSEEK_BASE_URL: 'https://deepseek.example'
  },
  fetchImpl: async (url, options = {}) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [{
            message: {
              content: '```json\n{"knowledgePoints":[{"name":"合力","canonicalName":"合外力","category":"动力学","confidence":0.92}],"relations":[]}\n```'
            }
          }]
        };
      }
    };
  }
});

const result = await service.extractQuestionKnowledge({
  bank: { subject: '物理', grade: '高一' },
  question: { id: 'q1', title: '求合力', options: [], answer: '6N', analysis: '' }
});
assert.equal(result.provider, 'deepseek');
assert.equal(result.model, 'deepseek-test');
assert.equal(result.knowledgePoints[0].canonicalKey, '合外力');
assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'https://deepseek.example/chat/completions');
assert.ok(calls[0].body.messages[0].content.includes('学生题目知识点提取'));

const explicit = createAiQuestionKnowledgeService({
  env: {},
  fetchImpl: async () => {
    throw new Error('explicit knowledge must not call a provider');
  }
});
const explicitResult = await explicit.extractQuestionKnowledge({
  bank: {},
  question: { id: 'q2', title: '题目', knowledge: ['牛顿第二定律'] }
});
assert.equal(explicitResult.provider, 'explicit');
assert.equal(explicitResult.knowledgePoints.length, 1);

const localResult = await explicit.extractQuestionKnowledge({
  bank: {},
  question: { id: 'q3', title: '没有标签的题目', knowledge: [] }
});
assert.equal(localResult.provider, 'local');
assert.deepEqual(localResult.knowledgePoints, []);

console.log('AI question knowledge service tests passed');
