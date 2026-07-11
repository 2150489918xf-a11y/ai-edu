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
    },
    async createKnowledgePoint(bankId, payload) {
      return { id: 'point-new', bankId, name: payload.name, graphRevision: 4 };
    },
    async updateKnowledgePoint(bankId, pointId, payload) {
      return { id: pointId, bankId, name: payload.name, graphRevision: 5 };
    },
    async mergeKnowledgePoint(bankId, pointId, payload) {
      return { id: pointId, bankId, mergedIntoId: payload.targetPointId, graphRevision: 6 };
    },
    async hideOrUnlinkKnowledgePoint(bankId, pointId, payload) {
      return { id: pointId, bankId, mode: payload.mode, graphRevision: 7 };
    },
    async createRelation(bankId, payload) {
      return { id: 'relation-new', bankId, label: payload.label, graphRevision: 8 };
    },
    async updateRelation(bankId, relationId, payload) {
      return { id: relationId, bankId, label: payload.label, graphRevision: 9 };
    },
    async deleteRelation(bankId, relationId) {
      return { id: relationId, bankId, deleted: true, graphRevision: 10 };
    },
    async saveLayout(bankId) {
      return { bankId, graphRevision: 11 };
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

  const createdPoint = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-points', {
    method: 'POST', body: JSON.stringify({ name: '动力学', graphRevision: 3 })
  });
  assert.equal(createdPoint.response.status, 201);
  assert.equal(createdPoint.payload.data.id, 'point-new');

  const updatedPoint = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-points/point-1', {
    method: 'PATCH', body: JSON.stringify({ name: '动力学模型', graphRevision: 4 })
  });
  assert.equal(updatedPoint.response.status, 200);
  assert.equal(updatedPoint.payload.data.name, '动力学模型');

  const mergedPoint = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-points/point-1/merge', {
    method: 'POST', body: JSON.stringify({ targetPointId: 'point-2', graphRevision: 5 })
  });
  assert.equal(mergedPoint.response.status, 200);
  assert.equal(mergedPoint.payload.data.mergedIntoId, 'point-2');

  const hiddenPoint = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-points/point-1?mode=hide', {
    method: 'DELETE', body: JSON.stringify({ graphRevision: 6 })
  });
  assert.equal(hiddenPoint.response.status, 200);
  assert.equal(hiddenPoint.payload.data.mode, 'hide');

  const createdRelation = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-relations', {
    method: 'POST', body: JSON.stringify({ label: '前置', graphRevision: 7 })
  });
  assert.equal(createdRelation.response.status, 201);

  const updatedRelation = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-relations/relation-1', {
    method: 'PATCH', body: JSON.stringify({ label: '应用于', graphRevision: 8 })
  });
  assert.equal(updatedRelation.response.status, 200);
  assert.equal(updatedRelation.payload.data.label, '应用于');

  const deletedRelation = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-relations/relation-1', {
    method: 'DELETE', body: JSON.stringify({ graphRevision: 9 })
  });
  assert.equal(deletedRelation.response.status, 200);

  const layout = await requestJson(baseUrl, '/api/v1/question-banks/bank-1/knowledge-graph/layout', {
    method: 'PUT', body: JSON.stringify({ graphRevision: 10, nodes: [] })
  });
  assert.equal(layout.response.status, 200);
  assert.equal(layout.payload.data.graphRevision, 11);

  console.log('question knowledge graph API tests passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
