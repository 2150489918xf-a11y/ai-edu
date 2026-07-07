import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  archiveCourse,
  createCourse,
  getCourse,
  listCourses,
  restoreCourse,
  updateCourse
} from '../src/data/courseApiClient.js';

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

    if (req.method === 'GET' && url.pathname === '/api/v1/courses') {
      assert.equal(url.searchParams.get('keyword'), 'newton');
      assert.equal(url.searchParams.get('status'), 'active');
      sendJson(res, 200, {
        data: [{ id: 'course-newton-2', title: 'Newton Second Law', subject: 'Physics', grade: 'Grade 10' }],
        pagination: { page: 1, pageSize: 20, total: 1 }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/courses') {
      const body = await readJsonBody(req);
      assert.equal(body.title, 'Momentum Conservation');
      assert.equal(body.duration, '45 minutes');
      assert.equal(body.goal, 'Understand when momentum is conserved.');
      assert.deepEqual(body.knowledge, ['momentum', 'impulse']);
      sendJson(res, 201, { data: { id: 'course-momentum', ...body, status: 'active' } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/courses/course-newton-2') {
      sendJson(res, 200, {
        data: { id: 'course-newton-2', title: 'Newton Second Law', subject: 'Physics', grade: 'Grade 10' }
      });
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/v1/courses/course-newton-2') {
      const body = await readJsonBody(req);
      assert.equal(body.description, 'Updated description');
      assert.equal(body.hasOutline, true);
      assert.equal(body.progress, 58);
      assert.equal(body.materialUploaded, true);
      assert.equal(body.materialName, 'newton-source.pdf');
      assert.equal(body.outline.version, 'v1');
      sendJson(res, 200, {
        data: { id: 'course-newton-2', title: 'Newton Second Law', ...body }
      });
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/v1/courses/course-newton-2') {
      sendJson(res, 200, { data: { id: 'course-newton-2', status: 'archived' } });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/courses/course-newton-2/restore') {
      sendJson(res, 200, { data: { id: 'course-newton-2', status: 'active' } });
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
  const courses = await listCourses({ keyword: 'newton', status: 'active' });
  assert.equal(courses.data[0].id, 'course-newton-2');
  assert.equal(courses.pagination.total, 1);

  const created = await createCourse({
    title: 'Momentum Conservation',
    subject: 'Physics',
    grade: 'Grade 10',
    duration: '45 minutes',
    goal: 'Understand when momentum is conserved.',
    knowledge: ['momentum', 'impulse'],
    description: 'Momentum conservation law'
  });
  assert.equal(created.id, 'course-momentum');

  const detail = await getCourse('course-newton-2');
  assert.equal(detail.title, 'Newton Second Law');

  const updated = await updateCourse('course-newton-2', {
    description: 'Updated description',
    hasOutline: true,
    progress: 58,
    materialUploaded: true,
    materialName: 'newton-source.pdf',
    outline: { version: 'v1' }
  });
  assert.equal(updated.description, 'Updated description');
  assert.equal(updated.hasOutline, true);
  assert.equal(updated.progress, 58);

  const archived = await archiveCourse('course-newton-2');
  assert.equal(archived.status, 'archived');

  const restored = await restoreCourse('course-newton-2');
  assert.equal(restored.status, 'active');

  assert.deepEqual(
    calls.map((item) => `${item.method} ${item.path}`),
    [
      'GET /api/v1/courses',
      'POST /api/v1/courses',
      'GET /api/v1/courses/course-newton-2',
      'PATCH /api/v1/courses/course-newton-2',
      'DELETE /api/v1/courses/course-newton-2',
      'POST /api/v1/courses/course-newton-2/restore'
    ]
  );

  console.log('course API client contracts passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
