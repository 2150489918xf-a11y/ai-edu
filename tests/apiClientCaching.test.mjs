import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { clearAllApiCaches } from '../src/data/apiCache.js';
import { createCourse, listCourseGroups, listCourses } from '../src/data/courseApiClient.js';
import { listKnowledgeCategories } from '../src/data/knowledgeApiClient.js';
import { getQuestionBank, listQuestionBanks } from '../src/data/questionBankApiClient.js';
import { getStudentCourseGroups } from '../src/data/studentApiClient.js';
import { listAdminTeachers } from '../src/data/adminApiClient.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
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
    calls.push(`${req.method} ${url.pathname}`);

    if (req.method === 'GET' && url.pathname === '/api/v1/courses') {
      sendJson(res, 200, {
        data: [{ id: 'course-newton', title: 'Newton' }],
        pagination: { page: 1, pageSize: 20, total: 1 }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/courses') {
      const body = await readJsonBody(req);
      sendJson(res, 201, { data: { id: 'course-created', ...body } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/course-groups') {
      sendJson(res, 200, { data: [{ id: 'group-physics', title: 'Physics' }] });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/question-banks') {
      sendJson(res, 200, {
        data: [{ id: 'bank-newton', title: 'Newton bank' }],
        pagination: { page: 1, pageSize: 20, total: 1 }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/question-banks/bank-newton') {
      sendJson(res, 200, { data: { id: 'bank-newton', questions: [] } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/knowledge-categories') {
      sendJson(res, 200, {
        data: [{ id: 'cat-physics', name: 'Physics' }],
        pagination: { page: 1, pageSize: 100, total: 1 }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/student/course-groups') {
      sendJson(res, 200, { data: { student: { id: 'stu-1' }, courses: [] } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/admin/teachers') {
      sendJson(res, 200, {
        data: [{ id: 'teacher-1', name: 'Teacher' }],
        pagination: { page: 1, pageSize: 20, total: 1 }
      });
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

globalThis.sessionStorage = new Map();
globalThis.sessionStorage.getItem = globalThis.sessionStorage.get.bind(globalThis.sessionStorage);
globalThis.sessionStorage.setItem = globalThis.sessionStorage.set.bind(globalThis.sessionStorage);
globalThis.sessionStorage.removeItem = globalThis.sessionStorage.delete.bind(globalThis.sessionStorage);
globalThis.sessionStorage.key = (index) => [...globalThis.sessionStorage.keys()][index] || null;
Object.defineProperty(globalThis.sessionStorage, 'length', {
  get() {
    return globalThis.sessionStorage.size;
  }
});

globalThis.localStorage = new Map();
globalThis.localStorage.getItem = globalThis.localStorage.get.bind(globalThis.localStorage);
globalThis.localStorage.setItem = globalThis.localStorage.set.bind(globalThis.localStorage);
globalThis.localStorage.removeItem = globalThis.localStorage.delete.bind(globalThis.localStorage);

const { server, calls, baseUrl } = await listen();
globalThis.__EDUAI_API_BASE_URL__ = baseUrl;

try {
  await listCourses({ status: 'active' });
  await listCourses({ status: 'active' });
  await listCourseGroups({ status: 'active' });
  await listCourseGroups({ status: 'active' });
  await listQuestionBanks({ status: 'active' });
  await listQuestionBanks({ status: 'active' });
  await getQuestionBank('bank-newton');
  await getQuestionBank('bank-newton');
  await listKnowledgeCategories({ status: 'active' });
  await listKnowledgeCategories({ status: 'active' });
  await getStudentCourseGroups('stu-1');
  await getStudentCourseGroups('stu-1');
  await listAdminTeachers({ status: 'active' });
  await listAdminTeachers({ status: 'active' });

  assert.deepEqual(calls, [
    'GET /api/v1/courses',
    'GET /api/v1/course-groups',
    'GET /api/v1/question-banks',
    'GET /api/v1/question-banks/bank-newton',
    'GET /api/v1/knowledge-categories',
    'GET /api/v1/student/course-groups',
    'GET /api/v1/admin/teachers'
  ]);

  await createCourse({ title: 'Created course' });
  await listCourses({ status: 'active' });
  assert.deepEqual(calls.slice(-2), [
    'POST /api/v1/courses',
    'GET /api/v1/courses'
  ]);

  console.log('api client caching contracts passed');
} finally {
  clearAllApiCaches();
  delete globalThis.__EDUAI_API_BASE_URL__;
  delete globalThis.sessionStorage;
  delete globalThis.localStorage;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
