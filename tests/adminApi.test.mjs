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

function createMockAdminService() {
  return {
    async getSummary() {
      return { teacherCount: 2, classCount: 3, studentCount: 40, courseCount: 6, enrollmentCount: 8 };
    },
    async listTeachers(filters = {}) {
      assert.equal(filters.status, 'active');
      return {
        teachers: [{ id: 'teacher-wang', name: '王老师', username: 'teacher-wang', classCount: 2, courseCount: 4 }],
        total: 1
      };
    },
    async createTeacher(payload = {}) {
      assert.equal(payload.username, 'teacher-li');
      return { id: 'teacher-li', name: payload.name, username: payload.username, status: 'active' };
    },
    async updateTeacher(teacherId, payload = {}) {
      assert.equal(teacherId, 'teacher-wang');
      assert.equal(payload.name, '王老师（教研组）');
      return { id: teacherId, name: payload.name, status: 'active' };
    },
    async archiveTeacher(teacherId) {
      assert.equal(teacherId, 'teacher-wang');
      return { id: teacherId, status: 'archived' };
    },
    async restoreTeacher(teacherId) {
      assert.equal(teacherId, 'teacher-wang');
      return { id: teacherId, status: 'active' };
    },
    async listStudentEnrollments(studentId) {
      assert.equal(studentId, 'stu-chenyu');
      return {
        student: { id: studentId, name: '陈雨', className: '高一 3 班' },
        classCourses: [{ courseId: 'course-newton-2', source: 'class' }],
        enrollments: [{ courseId: 'course-reading', source: 'manual' }]
      };
    },
    async assignStudentCourse(studentId, payload = {}) {
      assert.equal(studentId, 'stu-chenyu');
      assert.equal(payload.courseId, 'course-motion');
      return { studentId, courseId: payload.courseId, status: 'active' };
    },
    async removeStudentCourse(studentId, courseId) {
      assert.equal(studentId, 'stu-chenyu');
      assert.equal(courseId, 'course-reading');
      return { studentId, courseId, status: 'archived' };
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
  adminService: createMockAdminService()
});
const { server, baseUrl } = await listen(app);

try {
  const summary = await requestJson(baseUrl, '/api/v1/admin/summary');
  assert.equal(summary.response.status, 200);
  assert.equal(summary.payload.data.studentCount, 40);

  const teachers = await requestJson(baseUrl, '/api/v1/admin/teachers?status=active');
  assert.equal(teachers.response.status, 200);
  assert.equal(teachers.payload.data[0].id, 'teacher-wang');

  const created = await requestJson(baseUrl, '/api/v1/admin/teachers', {
    method: 'POST',
    body: JSON.stringify({ username: 'teacher-li', name: '李老师' })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.data.username, 'teacher-li');

  const updated = await requestJson(baseUrl, '/api/v1/admin/teachers/teacher-wang', {
    method: 'PATCH',
    body: JSON.stringify({ name: '王老师（教研组）' })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.data.name, '王老师（教研组）');

  const archived = await requestJson(baseUrl, '/api/v1/admin/teachers/teacher-wang', { method: 'DELETE' });
  assert.equal(archived.response.status, 200);
  assert.equal(archived.payload.data.status, 'archived');

  const restored = await requestJson(baseUrl, '/api/v1/admin/teachers/teacher-wang/restore', { method: 'POST' });
  assert.equal(restored.response.status, 200);
  assert.equal(restored.payload.data.status, 'active');

  const enrollments = await requestJson(baseUrl, '/api/v1/admin/students/stu-chenyu/enrollments');
  assert.equal(enrollments.response.status, 200);
  assert.equal(enrollments.payload.data.student.name, '陈雨');

  const assigned = await requestJson(baseUrl, '/api/v1/admin/students/stu-chenyu/enrollments', {
    method: 'POST',
    body: JSON.stringify({ courseId: 'course-motion' })
  });
  assert.equal(assigned.response.status, 201);
  assert.equal(assigned.payload.data.status, 'active');

  const removed = await requestJson(baseUrl, '/api/v1/admin/students/stu-chenyu/enrollments/course-reading', { method: 'DELETE' });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.payload.data.status, 'archived');

  console.log('admin API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
