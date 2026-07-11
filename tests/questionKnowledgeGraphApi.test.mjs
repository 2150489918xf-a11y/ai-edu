import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

import { createLearningApiApp } from '../server/app.js';

const appSource = readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
assert.ok(!appSource.includes('courseGroupKnowledgeGraphMatch'));
assert.ok(!appSource.includes('courseGroupKnowledgeGraphGenerateMatch'));
assert.ok(!indexSource.includes('createAiKnowledgeGraphService'));

function createLearningService() {
  return {
    async getClasses() { return []; },
    async getStudents() { return { classes: [], students: [], total: 0 }; }
  };
}

function createGraphService() {
  return {
    async getGraph(bankId) {
      return { bank: { id: bankId }, revision: 3, stats: {}, nodes: [], edges: [] };
    },
    async getKnowledgePointDetail(bankId, pointId) {
      return { id: pointId, bankId, questions: [] };
    },
    async analyzePending(bankId) {
      return { bankId, queued: 2 };
    },
    async reconcileBank(bankId) {
      return { bankId, queued: 4 };
    },
    async retryQuestionExtraction(questionId) {
      return { questionId, status: 'pending' };
    }
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  return { response, payload: await response.json() };
}

const app = createLearningApiApp({
  learningService: createLearningService(),
  questionKnowledgeGraphService: createGraphService()
});
const { server, baseUrl } = await listen(app);

try {
  const graph = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-graph');
  assert.equal(graph.response.status, 200);
  assert.equal(graph.payload.data.revision, 3);

  const point = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-points/point-1');
  assert.equal(point.response.status, 200);
  assert.equal(point.payload.data.id, 'point-1');

  const analyze = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-graph/analyze-pending', {
    method: 'POST', body: '{}'
  });
  assert.equal(analyze.response.status, 200);
  assert.equal(analyze.payload.data.queued, 2);

  const reconcile = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-graph/reconcile', {
    method: 'POST', body: '{}'
  });
  assert.equal(reconcile.response.status, 200);
  assert.equal(reconcile.payload.data.queued, 4);

  const retry = await requestJson(baseUrl, '/api/v1/questions/q-1/knowledge-extraction/retry', {
    method: 'POST', body: '{}'
  });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.payload.data.status, 'pending');

  console.log('question knowledge graph API tests passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
