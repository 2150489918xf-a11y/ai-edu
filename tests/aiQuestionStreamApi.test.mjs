import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

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

function createMockQuestionBankService() {
  return {
    async getBank(bankId) {
      assert.equal(bankId, 'newton-laws-bank');
      return { id: bankId, title: 'Newton bank', subject: 'Physics', questions: [] };
    }
  };
}

function createMockAiQuestionService() {
  return {
    async streamQuestions(payload, handlers) {
      assert.equal(payload.bank.id, 'newton-laws-bank');
      assert.equal(payload.prompt, 'stream one question');
      handlers.onDelta('thinking...');
      handlers.onQuestion({
        type: 'single-choice',
        stage: 'in-class',
        difficulty: 'basic',
        title: 'Streamed API question',
        options: ['A'],
        answer: 'A',
        analysis: '',
        knowledge: ['stream']
      });
      handlers.onDone({ provider: 'deepseek', model: 'deepseek-chat' });
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

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  questionBankService: createMockQuestionBankService(),
  aiQuestionService: createMockAiQuestionService()
});
const { server, baseUrl } = await listen(app);

try {
  const response = await fetch(`${baseUrl}/api/v1/question-banks/newton-laws-bank/ai-generate-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'stream one question' })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.ok(body.includes('event: delta'));
  assert.ok(body.includes('"text":"thinking..."'));
  assert.ok(body.includes('event: question'));
  assert.ok(body.includes('"title":"Streamed API question"'));
  assert.ok(body.includes('event: done'));
  assert.ok(body.includes('"provider":"deepseek"'));

  console.log('AI question stream API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
