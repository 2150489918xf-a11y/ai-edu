import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockQuestionBankService() {
  return {
    async getBank(bankId) {
      assert.equal(bankId, 'newton-laws-bank');
      return {
        id: bankId,
        title: '牛顿第二定律题库',
        subject: '物理',
        grade: '高一',
        questions: []
      };
    }
  };
}

function createMockAiQuestionService() {
  return {
    async generateQuestions(payload = {}) {
      assert.equal(payload.bank.id, 'newton-laws-bank');
      assert.equal(payload.prompt, '生成 2 道 F=ma 基础题');
      assert.equal(payload.analysis.title, '合外力方向');
      assert.equal(payload.messages[0].role, 'teacher');
      return {
        provider: 'deepseek',
        model: 'deepseek-chat',
        reply: '已生成题目',
        questions: [
          {
            type: '单选题',
            stage: '课中',
            difficulty: '基础',
            title: 'F=ma 基础题',
            options: ['A', 'B'],
            answer: 'A',
            analysis: '解析',
            knowledge: ['牛顿第二定律']
          }
        ]
      };
    }
  };
}

function createMockLearningService() {
  return {
    async getClasses() {
      return [];
    },
    async getStudents() {
      return { classes: [], students: [], total: 0 };
    }
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  return { response, payload };
}

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  questionBankService: createMockQuestionBankService(),
  aiQuestionService: createMockAiQuestionService()
});
const { server, baseUrl } = await listen(app);

try {
  const generated = await requestJson(baseUrl, '/api/v1/question-banks/newton-laws-bank/ai-generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '生成 2 道 F=ma 基础题',
      analysis: { title: '合外力方向' },
      messages: [{ role: 'teacher', text: '题目短一点' }]
    })
  });

  assert.equal(generated.response.status, 200);
  assert.equal(generated.payload.data.provider, 'deepseek');
  assert.equal(generated.payload.data.questions[0].title, 'F=ma 基础题');

  console.log('AI question generation API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
