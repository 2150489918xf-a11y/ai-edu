import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  archiveAdminClass,
  archiveAdminCourse,
  archiveAdminStudent,
  createAdminClass,
  createAdminCourse,
  createAdminStudent,
  restoreAdminClass,
  restoreAdminCourse,
  restoreAdminStudent,
  restoreAdminTeacher,
  updateAdminClass,
  updateAdminCourse,
  updateAdminStudent
} from '../src/data/adminApiClient.js';

const calls = [];
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  calls.push({ method: req.method, path: req.url, body: body ? JSON.parse(body) : null });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: { ok: true } }));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
globalThis.__EDUAI_API_BASE_URL__ = `http://127.0.0.1:${server.address().port}/api/v1`;

try {
  await restoreAdminTeacher('teacher 1');
  await createAdminStudent({ name: '李明' });
  await updateAdminStudent('student 1', { name: '李明更新' });
  await archiveAdminStudent('student 1');
  await restoreAdminStudent('student 1');
  await createAdminClass({ name: '高一 1 班' });
  await updateAdminClass('class 1', { name: '高一 2 班' });
  await archiveAdminClass('class 1');
  await restoreAdminClass('class 1');
  await createAdminCourse({ title: '函数基础' });
  await updateAdminCourse('course 1', { title: '函数进阶' });
  await archiveAdminCourse('course 1');
  await restoreAdminCourse('course 1');

  assert.deepEqual(calls.map(({ method, path }) => `${method} ${path}`), [
    'POST /api/v1/admin/teachers/teacher%201/restore',
    'POST /api/v1/admin/students',
    'PATCH /api/v1/admin/students/student%201',
    'DELETE /api/v1/admin/students/student%201',
    'POST /api/v1/admin/students/student%201/restore',
    'POST /api/v1/admin/classes',
    'PATCH /api/v1/admin/classes/class%201',
    'DELETE /api/v1/admin/classes/class%201',
    'POST /api/v1/admin/classes/class%201/restore',
    'POST /api/v1/admin/courses',
    'PATCH /api/v1/admin/courses/course%201',
    'DELETE /api/v1/admin/courses/course%201',
    'POST /api/v1/admin/courses/course%201/restore'
  ]);
  console.log('admin API client CRUD contracts passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
