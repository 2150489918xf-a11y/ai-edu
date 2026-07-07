import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockQuestionBankService() {
  return {
    async listBanks(filters = {}) {
      assert.equal(filters.keyword, 'newton');
      assert.equal(filters.status, 'active');
      return {
        banks: [{ id: 'bank-newton', title: 'Newton bank', subject: 'Physics', count: 1, status: 'active' }],
        total: 1
      };
    },
    async createBank(payload = {}) {
      assert.equal(payload.title, 'Momentum bank');
      return { id: 'bank-momentum', ...payload, count: 0, status: 'active' };
    },
    async getBank(bankId) {
      assert.equal(bankId, 'bank-newton');
      return {
        id: bankId,
        title: 'Newton bank',
        subject: 'Physics',
        count: 1,
        status: 'active',
        questions: [{ id: 'question-1', title: 'F=ma question', status: 'active' }]
      };
    },
    async updateBank(bankId, payload = {}) {
      assert.equal(bankId, 'bank-newton');
      assert.equal(payload.title, 'Updated Newton bank');
      return { id: bankId, title: payload.title, status: 'active' };
    },
    async archiveBank(bankId) {
      assert.equal(bankId, 'bank-newton');
      return { id: bankId, status: 'archived' };
    },
    async createQuestion(bankId, payload = {}) {
      assert.equal(bankId, 'bank-newton');
      assert.equal(payload.title, 'Manual question');
      return { id: 'question-manual', bankId, ...payload, status: 'active' };
    },
    async updateQuestion(questionId, payload = {}) {
      assert.equal(questionId, 'question-1');
      assert.equal(payload.title, 'Updated question');
      return { id: questionId, ...payload, status: 'active' };
    },
    async archiveQuestion(questionId) {
      assert.equal(questionId, 'question-1');
      return { id: questionId, status: 'archived' };
    }
  };
}

function createMockLearningService() {
  return {
    async getClasses() {
      return [];
    },
    async getStudents() {
      return { classes: ['All'], students: [], total: 0 };
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
  questionBankService: createMockQuestionBankService()
});
const { server, baseUrl } = await listen(app);

try {
  const list = await requestJson(baseUrl, '/api/v1/question-banks?status=active&keyword=newton');
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data[0].id, 'bank-newton');
  assert.equal(list.payload.pagination.total, 1);

  const createdBank = await requestJson(baseUrl, '/api/v1/question-banks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Momentum bank', subject: 'Physics' })
  });
  assert.equal(createdBank.response.status, 201);
  assert.equal(createdBank.payload.data.id, 'bank-momentum');

  const bankDetail = await requestJson(baseUrl, '/api/v1/question-banks/bank-newton');
  assert.equal(bankDetail.response.status, 200);
  assert.equal(bankDetail.payload.data.questions[0].id, 'question-1');

  const updatedBank = await requestJson(baseUrl, '/api/v1/question-banks/bank-newton', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Updated Newton bank' })
  });
  assert.equal(updatedBank.response.status, 200);
  assert.equal(updatedBank.payload.data.title, 'Updated Newton bank');

  const createdQuestion = await requestJson(baseUrl, '/api/v1/question-banks/bank-newton/questions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Manual question', type: 'single-choice' })
  });
  assert.equal(createdQuestion.response.status, 201);
  assert.equal(createdQuestion.payload.data.id, 'question-manual');

  const updatedQuestion = await requestJson(baseUrl, '/api/v1/questions/question-1', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Updated question' })
  });
  assert.equal(updatedQuestion.response.status, 200);
  assert.equal(updatedQuestion.payload.data.title, 'Updated question');

  const archivedQuestion = await requestJson(baseUrl, '/api/v1/questions/question-1', { method: 'DELETE' });
  assert.equal(archivedQuestion.response.status, 200);
  assert.equal(archivedQuestion.payload.data.status, 'archived');

  const archivedBank = await requestJson(baseUrl, '/api/v1/question-banks/bank-newton', { method: 'DELETE' });
  assert.equal(archivedBank.response.status, 200);
  assert.equal(archivedBank.payload.data.status, 'archived');

  console.log('question bank CRUD API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
