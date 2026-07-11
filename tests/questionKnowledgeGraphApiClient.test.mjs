import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  analyzePendingQuestionKnowledge,
  createQuestionBankKnowledgePoint,
  createQuestionBankKnowledgeRelation,
  deleteQuestionBankKnowledgeRelation,
  getQuestionBankKnowledgeGraph,
  getQuestionBankKnowledgePoint,
  mergeQuestionBankKnowledgePoint,
  reconcileQuestionBankKnowledgeGraph,
  removeQuestionBankKnowledgePoint,
  retryQuestionKnowledgeExtraction,
  saveQuestionBankKnowledgeGraphLayout,
  updateQuestionBankKnowledgePoint,
  updateQuestionBankKnowledgeRelation
} from '../src/data/questionBankApiClient.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
    req.on('error', reject);
  });
}

const calls = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const body = await readBody(req);
  calls.push({ method: req.method, path: url.pathname, mode: url.searchParams.get('mode'), body });
  res.statusCode = req.method === 'POST' ? 201 : 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ data: { method: req.method, path: url.pathname, mode: url.searchParams.get('mode'), body } }));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
globalThis.__EDUAI_API_BASE_URL__ = `http://127.0.0.1:${server.address().port}/api/v1`;

try {
  assert.equal((await getQuestionBankKnowledgeGraph('bank 1')).path, '/api/v1/question-banks/bank%201/knowledge-graph');
  assert.equal((await getQuestionBankKnowledgePoint('bank 1', 'point 1')).path, '/api/v1/question-banks/bank%201/knowledge-points/point%201');
  await analyzePendingQuestionKnowledge('bank 1');
  await reconcileQuestionBankKnowledgeGraph('bank 1');
  await retryQuestionKnowledgeExtraction('question 1');
  await createQuestionBankKnowledgePoint('bank 1', { name: '力', graphRevision: 1 });
  await updateQuestionBankKnowledgePoint('bank 1', 'point 1', { name: '合力', graphRevision: 2 });
  await mergeQuestionBankKnowledgePoint('bank 1', 'point 1', { targetPointId: 'point 2', graphRevision: 3 });
  const removed = await removeQuestionBankKnowledgePoint('bank 1', 'point 1', 'hide', { graphRevision: 4 });
  assert.equal(removed.mode, 'hide');
  await createQuestionBankKnowledgeRelation('bank 1', { label: '前置', graphRevision: 5 });
  await updateQuestionBankKnowledgeRelation('bank 1', 'relation 1', { label: '应用', graphRevision: 6 });
  await deleteQuestionBankKnowledgeRelation('bank 1', 'relation 1', { graphRevision: 7 });
  await saveQuestionBankKnowledgeGraphLayout('bank 1', { graphRevision: 8, nodes: [] });

  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
    'GET /api/v1/question-banks/bank%201/knowledge-graph',
    'GET /api/v1/question-banks/bank%201/knowledge-points/point%201',
    'POST /api/v1/question-banks/bank%201/knowledge-graph/analyze-pending',
    'POST /api/v1/question-banks/bank%201/knowledge-graph/reconcile',
    'POST /api/v1/questions/question%201/knowledge-extraction/retry',
    'POST /api/v1/question-banks/bank%201/knowledge-points',
    'PATCH /api/v1/question-banks/bank%201/knowledge-points/point%201',
    'POST /api/v1/question-banks/bank%201/knowledge-points/point%201/merge',
    'DELETE /api/v1/question-banks/bank%201/knowledge-points/point%201',
    'POST /api/v1/question-banks/bank%201/knowledge-relations',
    'PATCH /api/v1/question-banks/bank%201/knowledge-relations/relation%201',
    'DELETE /api/v1/question-banks/bank%201/knowledge-relations/relation%201',
    'PUT /api/v1/question-banks/bank%201/knowledge-graph/layout'
  ]);

  console.log('question knowledge graph API client tests passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
