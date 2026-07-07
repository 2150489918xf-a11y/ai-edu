import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockCourseService() {
  return {
    async listCourses(filters = {}) {
      assert.equal(filters.status, 'active');
      assert.equal(filters.keyword, '牛顿');
      return {
        courses: [
          {
            id: 'course-newton-2',
            title: '牛顿第二定律',
            subject: '物理',
            grade: '高一',
            description: 'F=ma 与合外力计算',
            status: 'active',
            deletedAt: null
          }
        ],
        total: 1
      };
    },
    async createCourse(payload = {}) {
      assert.equal(payload.title, '动量守恒');
      return {
        id: 'course-momentum',
        title: payload.title,
        subject: payload.subject,
        grade: payload.grade,
        description: payload.description,
        status: 'active',
        deletedAt: null
      };
    },
    async getCourse(courseId) {
      assert.equal(courseId, 'course-newton-2');
      return {
        id: courseId,
        title: '牛顿第二定律',
        subject: '物理',
        grade: '高一',
        description: 'F=ma 与合外力计算',
        status: 'active',
        deletedAt: null
      };
    },
    async updateCourse(courseId, payload = {}) {
      assert.equal(courseId, 'course-newton-2');
      assert.equal(payload.title, '牛顿第二定律复习');
      return {
        id: courseId,
        title: payload.title,
        subject: '物理',
        grade: '高一',
        description: '更新后的说明',
        status: 'active',
        deletedAt: null
      };
    },
    async archiveCourse(courseId) {
      assert.equal(courseId, 'course-newton-2');
      return {
        id: courseId,
        title: '牛顿第二定律',
        subject: '物理',
        grade: '高一',
        status: 'archived',
        deletedAt: '2026-07-07T09:00:00.000Z'
      };
    },
    async restoreCourse(courseId) {
      assert.equal(courseId, 'course-newton-2');
      return {
        id: courseId,
        title: '牛顿第二定律',
        subject: '物理',
        grade: '高一',
        status: 'active',
        deletedAt: null
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
      return { classes: ['全部班级'], students: [], total: 0 };
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
  courseService: createMockCourseService()
});
const { server, baseUrl } = await listen(app);

try {
  const list = await requestJson(baseUrl, '/api/v1/courses?status=active&keyword=%E7%89%9B%E9%A1%BF');
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data[0].id, 'course-newton-2');
  assert.equal(list.payload.pagination.total, 1);

  const created = await requestJson(baseUrl, '/api/v1/courses', {
    method: 'POST',
    body: JSON.stringify({
      title: '动量守恒',
      subject: '物理',
      grade: '高一',
      description: '动量守恒定律'
    })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.data.id, 'course-momentum');

  const detail = await requestJson(baseUrl, '/api/v1/courses/course-newton-2');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.data.title, '牛顿第二定律');

  const updated = await requestJson(baseUrl, '/api/v1/courses/course-newton-2', {
    method: 'PATCH',
    body: JSON.stringify({ title: '牛顿第二定律复习' })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.data.title, '牛顿第二定律复习');

  const archived = await requestJson(baseUrl, '/api/v1/courses/course-newton-2', { method: 'DELETE' });
  assert.equal(archived.response.status, 200);
  assert.equal(archived.payload.data.status, 'archived');

  const restored = await requestJson(baseUrl, '/api/v1/courses/course-newton-2/restore', { method: 'POST' });
  assert.equal(restored.response.status, 200);
  assert.equal(restored.payload.data.status, 'active');

  console.log('course CRUD API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
