import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  archiveQuestion,
  createQuestionBank,
  createQuestion,
  generateAiQuestions,
  getQuestionBank,
  listQuestionBanks,
  streamAiQuestions,
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

    if (req.method === 'POST' && url.pathname === '/api/v1/question-banks') {
      const body = await readJsonBody(req);
      assert.equal(body.title, 'Manual bank');
      assert.equal(body.subject, 'Physics');
      sendJson(res, 201, { data: { id: 'bank-created', count: 0, status: 'active', ...body } });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/question-banks/bank-newton/questions') {
      const body = await readJsonBody(req);
      assert.equal(body.title, 'Manual question');
      sendJson(res, 201, { data: { id: 'q-manual', bankId: 'bank-newton', ...body } });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/question-banks/bank-newton/ai-generate') {
      const body = await readJsonBody(req);
      assert.equal(body.prompt, '生成一道牛顿第二定律题');
      assert.equal(body.analysis.title, '合外力方向');
      sendJson(res, 200, {
        data: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          reply: '已生成',
          questions: [{ title: 'AI generated question', type: '单选题' }]
        }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/question-banks/bank-newton/ai-generate-stream') {
      const body = await readJsonBody(req);
      assert.equal(body.prompt, '流式生成一道题');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.end([
        'event: delta',
        'data: {"text":"thinking"}',
        '',
        'event: question',
        'data: {"question":{"title":"Streamed client question","type":"单选题"}}',
        '',
        'event: done',
        'data: {"provider":"deepseek"}',
        '',
        ''
      ].join('\n'));
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

  const createdBank = await createQuestionBank({
    title: 'Manual bank',
    subject: 'Physics',
    grade: 'Grade 10',
    usage: 'in-class',
    description: 'Manual bank description',
    tags: ['F=ma']
  });
  assert.equal(createdBank.id, 'bank-created');
  assert.equal(createdBank.count, 0);

  const created = await createQuestion('bank-newton', { title: 'Manual question', type: 'single-choice' });
  assert.equal(created.id, 'q-manual');

  const generated = await generateAiQuestions('bank-newton', {
    prompt: '生成一道牛顿第二定律题',
    analysis: { title: '合外力方向' }
  });
  assert.equal(generated.provider, 'deepseek');
  assert.equal(generated.questions[0].title, 'AI generated question');

  const streamEvents = [];
  await streamAiQuestions('bank-newton', {
    prompt: '流式生成一道题'
  }, {
    onDelta: (text) => streamEvents.push({ type: 'delta', text }),
    onQuestion: (question) => streamEvents.push({ type: 'question', question }),
    onDone: (meta) => streamEvents.push({ type: 'done', meta })
  });
  assert.deepEqual(streamEvents, [
    { type: 'delta', text: 'thinking' },
    { type: 'question', question: { title: 'Streamed client question', type: '单选题' } },
    { type: 'done', meta: { provider: 'deepseek' } }
  ]);

  const updated = await updateQuestion('q1', { title: 'Updated question' });
  assert.equal(updated.title, 'Updated question');

  const archived = await archiveQuestion('q1');
  assert.equal(archived.status, 'archived');

  assert.deepEqual(calls, [
    'GET /api/v1/question-banks',
    'GET /api/v1/question-banks/bank-newton',
    'POST /api/v1/question-banks',
    'POST /api/v1/question-banks/bank-newton/questions',
    'POST /api/v1/question-banks/bank-newton/ai-generate',
    'POST /api/v1/question-banks/bank-newton/ai-generate-stream',
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
