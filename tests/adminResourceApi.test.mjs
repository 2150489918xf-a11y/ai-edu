import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createLearningApiApp } from '../server/app.js';

const calls = [];
const record = (resource, action, result) => async (...args) => {
  calls.push({ resource, action, args });
  return typeof result === 'function' ? result(...args) : result;
};

const studentService = {
  listStudents: record('students', 'list', { students: [{ id: 'stu-1' }], total: 1, classes: [] }),
  createStudent: record('students', 'create', (body) => ({ id: 'stu-new', ...body })),
  updateStudent: record('students', 'update', (id, body) => ({ id, ...body })),
  archiveStudent: record('students', 'archive', (id) => ({ id, status: 'archived' })),
  restoreStudent: record('students', 'restore', (id) => ({ id, status: 'active' }))
};
const classService = {
  listClasses: record('classes', 'list', { classes: [{ id: 'class-1' }], total: 1 }),
  createClass: record('classes', 'create', (body) => ({ id: 'class-new', ...body })),
  updateClass: record('classes', 'update', (id, body) => ({ id, ...body })),
  archiveClass: record('classes', 'archive', (id) => ({ id, status: 'archived' })),
  restoreClass: record('classes', 'restore', (id) => ({ id, status: 'active' }))
};
const courseService = {
  listCourses: record('courses', 'list', { courses: [{ id: 'course-1' }], total: 1 }),
  createCourse: record('courses', 'create', (body) => ({ id: 'course-new', ...body })),
  updateCourse: record('courses', 'update', (id, body) => ({ id, ...body })),
  archiveCourse: record('courses', 'archive', (id) => ({ id, status: 'archived' })),
  restoreCourse: record('courses', 'restore', (id) => ({ id, status: 'active' }))
};

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
  learningService: { async getClasses() { return []; }, async getStudents() { return { classes: [], students: [] }; } },
  studentService,
  classService,
  courseService
});
const { server, baseUrl } = await listen(app);

try {
  for (const resource of ['students', 'classes', 'courses']) {
    const list = await requestJson(baseUrl, `/api/v1/admin/${resource}?keyword=高一&status=all&page=2&pageSize=10`);
    assert.equal(list.response.status, 200, `${resource} list should exist`);
    assert.equal(list.payload.pagination.page, 2);
    assert.equal(list.payload.pagination.total, 1);

    const created = await requestJson(baseUrl, `/api/v1/admin/${resource}`, {
      method: 'POST',
      body: JSON.stringify({ name: '新增记录', title: '新增课程' })
    });
    assert.equal(created.response.status, 201);

    const updated = await requestJson(baseUrl, `/api/v1/admin/${resource}/${resource}-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '更新记录', title: '更新课程' })
    });
    assert.equal(updated.response.status, 200);

    const archived = await requestJson(baseUrl, `/api/v1/admin/${resource}/${resource}-1`, { method: 'DELETE' });
    assert.equal(archived.payload.data.status, 'archived');

    const restored = await requestJson(baseUrl, `/api/v1/admin/${resource}/${resource}-1/restore`, { method: 'POST' });
    assert.equal(restored.payload.data.status, 'active');
  }

  const studentListCall = calls.find((call) => call.resource === 'students' && call.action === 'list');
  assert.equal(studentListCall.args[0].keyword, '高一');
  assert.equal(studentListCall.args[0].status, 'all');
  assert.equal(studentListCall.args[0].page, 2);

  console.log('admin resource API contracts passed');
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
