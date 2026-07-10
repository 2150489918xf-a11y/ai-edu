import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  archiveKnowledgeCategory,
  archiveKnowledgeMaterial,
  createKnowledgeCategory,
  createKnowledgeMaterial,
  getKnowledgeMaterial,
  listKnowledgeCategories,
  listKnowledgeMaterials,
  updateKnowledgeCategory,
  updateKnowledgeMaterial
} from '../src/data/knowledgeApiClient.js';

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
    calls.push({ method: req.method, path: url.pathname, search: url.search });

    if (req.method === 'GET' && url.pathname === '/api/v1/knowledge-categories') {
      assert.equal(url.searchParams.get('status'), 'active');
      sendJson(res, 200, {
        data: [{ id: 'cat-math', name: '高一数学', icon: 'functions', count: 2 }],
        pagination: { page: 1, pageSize: 100, total: 1 }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/knowledge-categories') {
      const body = await readJsonBody(req);
      assert.equal(body.name, '高一数学');
      sendJson(res, 201, { data: { id: 'cat-created', ...body, count: 0 } });
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/v1/knowledge-categories/cat-math') {
      const body = await readJsonBody(req);
      assert.equal(body.name, '高一数学资料');
      sendJson(res, 200, { data: { id: 'cat-math', ...body, count: 2 } });
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/v1/knowledge-categories/cat-math') {
      sendJson(res, 200, { data: { id: 'cat-math', status: 'archived' } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/knowledge-materials') {
      assert.equal(url.searchParams.get('categoryId'), 'cat-math');
      assert.equal(url.searchParams.get('type'), 'PDF');
      sendJson(res, 200, {
        data: [{ id: 'mat-quadratic', title: '二次函数教材', type: 'PDF', categoryId: 'cat-math' }],
        pagination: { page: 1, pageSize: 20, total: 1 }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/knowledge-materials') {
      const body = await readJsonBody(req);
      assert.equal(body.title, '二次函数补充资料');
      sendJson(res, 201, { data: { id: 'mat-created', ...body } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/knowledge-materials/mat-quadratic') {
      sendJson(res, 200, { data: { id: 'mat-quadratic', title: '二次函数教材', evidenceCount: 42 } });
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/v1/knowledge-materials/mat-quadratic') {
      const body = await readJsonBody(req);
      assert.equal(body.title, '二次函数教材更新');
      sendJson(res, 200, { data: { id: 'mat-quadratic', ...body } });
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/v1/knowledge-materials/mat-quadratic') {
      sendJson(res, 200, { data: { id: 'mat-quadratic', status: 'archived' } });
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
  const categories = await listKnowledgeCategories({ status: 'active' });
  assert.equal(categories.data[0].id, 'cat-math');
  assert.equal(categories.pagination.total, 1);

  const createdCategory = await createKnowledgeCategory({ name: '高一数学', icon: 'functions' });
  assert.equal(createdCategory.id, 'cat-created');

  const updatedCategory = await updateKnowledgeCategory('cat-math', { name: '高一数学资料' });
  assert.equal(updatedCategory.name, '高一数学资料');

  const archivedCategory = await archiveKnowledgeCategory('cat-math');
  assert.equal(archivedCategory.status, 'archived');

  const materials = await listKnowledgeMaterials({ categoryId: 'cat-math', type: 'PDF' });
  assert.equal(materials.data[0].id, 'mat-quadratic');
  assert.equal(materials.pagination.total, 1);

  const createdMaterial = await createKnowledgeMaterial({
    categoryId: 'cat-math',
    title: '二次函数补充资料',
    type: 'PDF',
    subject: '数学',
    grade: '高一'
  });
  assert.equal(createdMaterial.id, 'mat-created');

  const detail = await getKnowledgeMaterial('mat-quadratic');
  assert.equal(detail.evidenceCount, 42);

  const updatedMaterial = await updateKnowledgeMaterial('mat-quadratic', { title: '二次函数教材更新' });
  assert.equal(updatedMaterial.title, '二次函数教材更新');

  const archivedMaterial = await archiveKnowledgeMaterial('mat-quadratic');
  assert.equal(archivedMaterial.status, 'archived');

  assert.deepEqual(
    calls.map((item) => `${item.method} ${item.path}`),
    [
      'GET /api/v1/knowledge-categories',
      'POST /api/v1/knowledge-categories',
      'PATCH /api/v1/knowledge-categories/cat-math',
      'DELETE /api/v1/knowledge-categories/cat-math',
      'GET /api/v1/knowledge-materials',
      'POST /api/v1/knowledge-materials',
      'GET /api/v1/knowledge-materials/mat-quadratic',
      'PATCH /api/v1/knowledge-materials/mat-quadratic',
      'DELETE /api/v1/knowledge-materials/mat-quadratic'
    ]
  );

  console.log('knowledge API client contracts passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
