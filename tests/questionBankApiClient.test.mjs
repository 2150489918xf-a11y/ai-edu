import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  archiveQuestion,
  createQuestion,
  getQuestionBank,
  listQuestionBanks,
  updateQuestion
} from '../src/data/questionBankApiClient.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      resolve(raw ? JSON.parse(raw) : {});
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function listen() {
  const calls = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    calls.push(`${req.method} ${url.pathname}`);

    if (req.method === 'GET' && url.pathname === '/api/v1/question-banks') {
      assert.equal(url.searchParams.get('keyword'), 'newton');
      sendJson(res, 200, {
        data: [{ id: 'bank-newton', title: 'Newton bank', count: 1 }],
        pagination: { page: 1, pageSize: 20, total: 1 }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/question-banks/bank-newton') {
      sendJson(res, 200, {
        data: { id: 'bank-newton', title: 'Newton bank', questions: [{ id: 'q1', title: 'F=ma' }] }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/question-banks/bank-newton/questions') {
      const body = await readJsonBody(req);
      assert.equal(body.title, 'Manual question');
      sendJson(res, 201, { data: { id: 'q-manual', bankId: 'bank-newton', ...body } });
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/v1/questions/q1') {
      const body = await readJsonBody(req);
      assert.equal(body.title, 'Updated question');
      sendJson(res, 200, { data: { id: 'q1', ...body } });
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/v1/questions/q1') {
      sendJson(res, 200, { data: { id: 'q1', status: 'archived' } });
      return;
    }

    sendJson(res, 404, { error: { code: 'NOT_FOUND' } });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, calls, baseUrl: `http://127.0.0.1:${address.port}/api/v1` });
    });
  });
}

const { server, calls, baseUrl } = await listen();
globalThis.__EDUAI_API_BASE_URL__ = baseUrl;

try {
  const banks = await listQuestionBanks({ keyword: 'newton' });
  assert.equal(banks.data[0].id, 'bank-newton');
  assert.equal(banks.pagination.total, 1);

  const detail = await getQuestionBank('bank-newton');
  assert.equal(detail.questions[0].id, 'q1');

  const created = await createQuestion('bank-newton', { title: 'Manual question', type: 'single-choice' });
  assert.equal(created.id, 'q-manual');

  const updated = await updateQuestion('q1', { title: 'Updated question' });
  assert.equal(updated.title, 'Updated question');

  const archived = await archiveQuestion('q1');
  assert.equal(archived.status, 'archived');

  assert.deepEqual(calls, [
    'GET /api/v1/question-banks',
    'GET /api/v1/question-banks/bank-newton',
    'POST /api/v1/question-banks/bank-newton/questions',
    'PATCH /api/v1/questions/q1',
    'DELETE /api/v1/questions/q1'
  ]);

  console.log('question bank API client contracts passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
