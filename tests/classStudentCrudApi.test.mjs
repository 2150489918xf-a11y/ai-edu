import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockClassService() {
  return {
    async listClasses(filters = {}) {
      assert.equal(filters.status, 'active');
      return {
        classes: [
          {
            id: 'class-physics-1',
            name: '高一 3 班',
            grade: '高一',
            subject: '物理',
            status: 'active',
            studentCount: 2,
            deletedAt: null
          }
        ],
        total: 1
      };
    },
    async createClass(payload = {}) {
      assert.equal(payload.name, '高一 5 班');
      return { id: 'class-physics-5', ...payload, status: 'active', deletedAt: null };
    },
    async getClass(classId) {
      assert.equal(classId, 'class-physics-1');
      return { id: classId, name: '高一 3 班', grade: '高一', subject: '物理', status: 'active' };
    },
    async updateClass(classId, payload = {}) {
      assert.equal(classId, 'class-physics-1');
      assert.equal(payload.name, '高一 3 班（实验班）');
      return { id: classId, name: payload.name, grade: '高一', subject: '物理', status: 'active' };
    },
    async archiveClass(classId) {
      assert.equal(classId, 'class-physics-1');
      return { id: classId, name: '高一 3 班', status: 'archived', deletedAt: '2026-07-07T09:00:00.000Z' };
    },
    async restoreClass(classId) {
      assert.equal(classId, 'class-physics-1');
      return { id: classId, name: '高一 3 班', status: 'active', deletedAt: null };
    }
  };
}

function createMockStudentService() {
  return {
    async listStudents(filters = {}) {
      assert.equal(filters.classId, 'class-physics-1');
      return {
        classes: ['全部班级', '高一 3 班'],
        students: [
          {
            id: 'stu-liming',
            name: '李明',
            classId: 'class-physics-1',
            className: '高一 3 班',
            studentNo: '2026001',
            status: 'active',
            deletedAt: null
          }
        ],
        total: 1
      };
    },
    async createStudent(payload = {}) {
      assert.equal(payload.name, '赵楠');
      return { id: 'stu-zhaonan', ...payload, status: 'active', deletedAt: null };
    },
    async getStudent(studentId) {
      assert.equal(studentId, 'stu-liming');
      return { id: studentId, name: '李明', classId: 'class-physics-1', className: '高一 3 班', status: 'active' };
    },
    async updateStudent(studentId, payload = {}) {
      assert.equal(studentId, 'stu-liming');
      assert.equal(payload.studentNo, '2026099');
      return { id: studentId, name: '李明', studentNo: payload.studentNo, status: 'active' };
    },
    async transferStudent(studentId, payload = {}) {
      assert.equal(studentId, 'stu-liming');
      assert.equal(payload.classId, 'class-physics-2');
      return { id: studentId, name: '李明', classId: 'class-physics-2', className: '高一 4 班', status: 'active' };
    },
    async archiveStudent(studentId) {
      assert.equal(studentId, 'stu-liming');
      return { id: studentId, name: '李明', status: 'archived', deletedAt: '2026-07-07T09:00:00.000Z' };
    },
    async restoreStudent(studentId) {
      assert.equal(studentId, 'stu-liming');
      return { id: studentId, name: '李明', status: 'active', deletedAt: null };
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
  return { response, payload: await response.json() };
}

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  classService: createMockClassService(),
  studentService: createMockStudentService()
});
const { server, baseUrl } = await listen(app);

try {
  const classList = await requestJson(baseUrl, '/api/v1/classes?status=active');
  assert.equal(classList.response.status, 200);
  assert.equal(classList.payload.data[0].id, 'class-physics-1');

  const classCreated = await requestJson(baseUrl, '/api/v1/classes', {
    method: 'POST',
    body: JSON.stringify({ name: '高一 5 班', grade: '高一', subject: '物理' })
  });
  assert.equal(classCreated.response.status, 201);
  assert.equal(classCreated.payload.data.id, 'class-physics-5');

  const classDetail = await requestJson(baseUrl, '/api/v1/classes/class-physics-1');
  assert.equal(classDetail.response.status, 200);
  assert.equal(classDetail.payload.data.name, '高一 3 班');

  const classUpdated = await requestJson(baseUrl, '/api/v1/classes/class-physics-1', {
    method: 'PATCH',
    body: JSON.stringify({ name: '高一 3 班（实验班）' })
  });
  assert.equal(classUpdated.payload.data.name, '高一 3 班（实验班）');

  const classArchived = await requestJson(baseUrl, '/api/v1/classes/class-physics-1', { method: 'DELETE' });
  assert.equal(classArchived.payload.data.status, 'archived');

  const classRestored = await requestJson(baseUrl, '/api/v1/classes/class-physics-1/restore', { method: 'POST' });
  assert.equal(classRestored.payload.data.status, 'active');

  const studentList = await requestJson(baseUrl, '/api/v1/students?classId=class-physics-1');
  assert.equal(studentList.response.status, 200);
  assert.equal(studentList.payload.data[0].id, 'stu-liming');

  const studentCreated = await requestJson(baseUrl, '/api/v1/students', {
    method: 'POST',
    body: JSON.stringify({ name: '赵楠', classId: 'class-physics-1', studentNo: '2026005' })
  });
  assert.equal(studentCreated.response.status, 201);
  assert.equal(studentCreated.payload.data.id, 'stu-zhaonan');

  const studentDetail = await requestJson(baseUrl, '/api/v1/students/stu-liming');
  assert.equal(studentDetail.payload.data.name, '李明');

  const studentUpdated = await requestJson(baseUrl, '/api/v1/students/stu-liming', {
    method: 'PATCH',
    body: JSON.stringify({ studentNo: '2026099' })
  });
  assert.equal(studentUpdated.payload.data.studentNo, '2026099');

  const transferred = await requestJson(baseUrl, '/api/v1/students/stu-liming/transfer', {
    method: 'POST',
    body: JSON.stringify({ classId: 'class-physics-2' })
  });
  assert.equal(transferred.payload.data.classId, 'class-physics-2');

  const studentArchived = await requestJson(baseUrl, '/api/v1/students/stu-liming', { method: 'DELETE' });
  assert.equal(studentArchived.payload.data.status, 'archived');

  const studentRestored = await requestJson(baseUrl, '/api/v1/students/stu-liming/restore', { method: 'POST' });
  assert.equal(studentRestored.payload.data.status, 'active');

  console.log('class and student CRUD API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
