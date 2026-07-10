import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockLearningService() {
  return {
    async getClasses() {
      return [];
    },
    async getStudents() {
      return { classes: ['全部班级'], students: [], total: 0 };
    }
  };
}

function createMockKnowledgeService() {
  return {
    async listCategories(filters = {}) {
      assert.equal(filters.status, 'active');
      return {
        categories: [
          { id: 'cat-math', name: '高一数学', icon: 'functions', count: 2, status: 'active' }
        ],
        total: 1
      };
    },
    async createCategory(payload = {}) {
      assert.equal(payload.name, '高一数学');
      return { id: 'cat-created', name: payload.name, icon: payload.icon, count: 0, status: 'active' };
    },
    async updateCategory(categoryId, payload = {}) {
      assert.equal(categoryId, 'cat-math');
      assert.equal(payload.name, '高一数学资料');
      return { id: categoryId, name: payload.name, icon: 'functions', count: 2, status: 'active' };
    },
    async archiveCategory(categoryId) {
      assert.equal(categoryId, 'cat-math');
      return { id: categoryId, name: '高一数学', icon: 'functions', count: 0, status: 'archived' };
    },
    async listMaterials(filters = {}) {
      assert.equal(filters.categoryId, 'cat-math');
      assert.equal(filters.type, 'PDF');
      assert.equal(filters.keyword, '函数');
      return {
        materials: [
          {
            id: 'mat-quadratic',
            categoryId: 'cat-math',
            title: '二次函数图像与性质教材节选',
            type: 'PDF',
            status: 'parsed',
            evidenceCount: 42
          }
        ],
        total: 1
      };
    },
    async createMaterial(payload = {}) {
      assert.equal(payload.categoryId, 'cat-math');
      assert.equal(payload.title, '二次函数补充资料');
      return {
        id: 'mat-created',
        categoryId: payload.categoryId,
        title: payload.title,
        type: payload.type,
        status: 'parsed',
        evidenceCount: 0
      };
    },
    async getMaterial(materialId) {
      assert.equal(materialId, 'mat-quadratic');
      return {
        id: materialId,
        categoryId: 'cat-math',
        title: '二次函数图像与性质教材节选',
        type: 'PDF',
        status: 'parsed',
        evidenceCount: 42
      };
    },
    async updateMaterial(materialId, payload = {}) {
      assert.equal(materialId, 'mat-quadratic');
      assert.equal(payload.title, '二次函数教材更新');
      return {
        id: materialId,
        categoryId: 'cat-math',
        title: payload.title,
        type: 'PDF',
        status: 'parsed',
        evidenceCount: 42
      };
    },
    async archiveMaterial(materialId) {
      assert.equal(materialId, 'mat-quadratic');
      return {
        id: materialId,
        categoryId: 'cat-math',
        title: '二次函数图像与性质教材节选',
        type: 'PDF',
        status: 'archived',
        evidenceCount: 42
      };
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
  knowledgeService: createMockKnowledgeService()
});
const { server, baseUrl } = await listen(app);

try {
  const categoryList = await requestJson(baseUrl, '/api/v1/knowledge-categories?status=active');
  assert.equal(categoryList.response.status, 200);
  assert.equal(categoryList.payload.data[0].id, 'cat-math');
  assert.equal(categoryList.payload.pagination.total, 1);

  const createdCategory = await requestJson(baseUrl, '/api/v1/knowledge-categories', {
    method: 'POST',
    body: JSON.stringify({ name: '高一数学', icon: 'functions' })
  });
  assert.equal(createdCategory.response.status, 201);
  assert.equal(createdCategory.payload.data.id, 'cat-created');

  const updatedCategory = await requestJson(baseUrl, '/api/v1/knowledge-categories/cat-math', {
    method: 'PATCH',
    body: JSON.stringify({ name: '高一数学资料' })
  });
  assert.equal(updatedCategory.response.status, 200);
  assert.equal(updatedCategory.payload.data.name, '高一数学资料');

  const archivedCategory = await requestJson(baseUrl, '/api/v1/knowledge-categories/cat-math', { method: 'DELETE' });
  assert.equal(archivedCategory.response.status, 200);
  assert.equal(archivedCategory.payload.data.status, 'archived');

  const materialList = await requestJson(baseUrl, '/api/v1/knowledge-materials?categoryId=cat-math&type=PDF&keyword=%E5%87%BD%E6%95%B0');
  assert.equal(materialList.response.status, 200);
  assert.equal(materialList.payload.data[0].id, 'mat-quadratic');
  assert.equal(materialList.payload.pagination.total, 1);

  const createdMaterial = await requestJson(baseUrl, '/api/v1/knowledge-materials', {
    method: 'POST',
    body: JSON.stringify({
      categoryId: 'cat-math',
      title: '二次函数补充资料',
      type: 'PDF',
      subject: '数学',
      grade: '高一'
    })
  });
  assert.equal(createdMaterial.response.status, 201);
  assert.equal(createdMaterial.payload.data.id, 'mat-created');

  const materialDetail = await requestJson(baseUrl, '/api/v1/knowledge-materials/mat-quadratic');
  assert.equal(materialDetail.response.status, 200);
  assert.equal(materialDetail.payload.data.evidenceCount, 42);

  const updatedMaterial = await requestJson(baseUrl, '/api/v1/knowledge-materials/mat-quadratic', {
    method: 'PATCH',
    body: JSON.stringify({ title: '二次函数教材更新' })
  });
  assert.equal(updatedMaterial.response.status, 200);
  assert.equal(updatedMaterial.payload.data.title, '二次函数教材更新');

  const archivedMaterial = await requestJson(baseUrl, '/api/v1/knowledge-materials/mat-quadratic', { method: 'DELETE' });
  assert.equal(archivedMaterial.response.status, 200);
  assert.equal(archivedMaterial.payload.data.status, 'archived');

  console.log('knowledge base CRUD API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
