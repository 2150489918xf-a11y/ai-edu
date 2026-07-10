import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  generateStudentCourseProfile,
  getStudentDashboard,
  getStudentAnalysis,
  getStudentCourse,
  getStudentCourseAnalysis,
  getStudentTask,
  joinStudentCourse,
  listStudentCourseCatalog,
  listStudentCourses,
  saveStudentAnswer,
  streamStudentAiChat,
  submitStudentTask
} from '../src/data/studentApiClient.js';

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

    if (req.method === 'GET' && url.pathname === '/api/v1/student/courses') {
      assert.equal(url.searchParams.get('studentId'), 'stu-1');
      sendJson(res, 200, { data: [{ id: 'course-newton-2', title: '牛顿第二定律' }] });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/student/dashboard') {
      assert.equal(url.searchParams.get('studentId'), 'stu-1');
      sendJson(res, 200, {
        data: {
          student: {
            id: 'stu-1',
            name: '陈宇',
            className: '高一 3 班',
            studentNo: 'S20260103',
            teacher: '王老师'
          },
          courses: [{ id: 'course-newton-2', title: '牛顿第二定律', teacher: '王老师' }]
        }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/student/course-catalog') {
      assert.equal(url.searchParams.get('studentId'), 'stu-1');
      sendJson(res, 200, {
        data: [
          { id: 'course-newton-2', title: '牛顿第二定律', source: 'class', joined: true },
          { id: 'course-joined', title: '力的合成', source: 'available', joined: false }
        ]
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/student/analysis') {
      assert.equal(url.searchParams.get('studentId'), 'stu-1');
      sendJson(res, 200, {
        data: {
          student: { id: 'stu-1', name: '陈宇' },
          summary: { courseCount: 1, answeredCount: 4, accuracy: 50 },
          courses: [{ course: { id: 'course-newton-2', title: '牛顿第二定律' } }]
        }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/student/analysis/courses/course-newton-2') {
      assert.equal(url.searchParams.get('studentId'), 'stu-1');
      sendJson(res, 200, {
        data: {
          course: { id: 'course-newton-2', title: '牛顿第二定律' },
          summary: { accuracy: 50 },
          knowledgeStats: [{ name: '受力分析', accuracy: 33 }]
        }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/student/analysis/courses/course-newton-2/generate') {
      const body = await readJsonBody(req);
      assert.equal(body.studentId, 'stu-1');
      sendJson(res, 200, {
        data: {
          course: { id: 'course-newton-2', title: '牛顿第二定律' },
          profile: { aiConversationSummary: '受力分析不稳定' }
        }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/student/courses/join') {
      const body = await readJsonBody(req);
      assert.equal(body.studentId, 'stu-1');
      assert.equal(body.courseId, 'course-joined');
      sendJson(res, 200, {
        data: {
          enrollment: { id: 'enroll-1', courseId: 'course-joined', sessionId: 'session-joined' },
          course: { id: 'course-joined', title: '力的合成', source: 'joined' }
        }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/student/courses/course-newton-2') {
      assert.equal(url.searchParams.get('studentId'), 'stu-1');
      sendJson(res, 200, { data: { id: 'course-newton-2', tasks: [{ id: 'task-1' }] } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/student/tasks/task-1') {
      assert.equal(url.searchParams.get('studentId'), 'stu-1');
      sendJson(res, 200, { data: { id: 'task-1', questions: [{ id: 'q1', type: 'choice' }] } });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/student/tasks/task-1/answers') {
      const body = await readJsonBody(req);
      assert.equal(body.studentId, 'stu-1');
      assert.equal(body.questionId, 'q1');
      sendJson(res, 200, { data: { answeredCount: 1, totalCount: 1 } });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/student/tasks/task-1/submit') {
      const body = await readJsonBody(req);
      assert.equal(body.studentId, 'stu-1');
      sendJson(res, 200, { data: { status: 'completed', accuracy: 100 } });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/student/ai/chat-stream') {
      const body = await readJsonBody(req);
      assert.equal(body.studentId, 'stu-1');
      assert.equal(body.taskId, 'task-1');
      assert.equal(body.questionId, 'q1');
      assert.equal(body.message, '提示一下');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.end([
        'event: delta',
        'data: {"text":"先分析合力"}',
        '',
        'event: done',
        'data: {"provider":"deepseek"}',
        '',
        ''
      ].join('\n'));
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
  const courses = await listStudentCourses('stu-1');
  assert.equal(courses[0].title, '牛顿第二定律');

  const dashboard = await getStudentDashboard('stu-1');
  assert.equal(dashboard.student.name, '陈宇');
  assert.equal(dashboard.courses[0].teacher, '王老师');

  const catalog = await listStudentCourseCatalog('stu-1');
  assert.equal(catalog[0].joined, true);
  assert.equal(catalog[1].source, 'available');

  const analysis = await getStudentAnalysis('stu-1');
  assert.equal(analysis.summary.accuracy, 50);

  const courseAnalysis = await getStudentCourseAnalysis('stu-1', 'course-newton-2');
  assert.equal(courseAnalysis.knowledgeStats[0].name, '受力分析');

  const generatedProfile = await generateStudentCourseProfile('stu-1', 'course-newton-2');
  assert.equal(generatedProfile.profile.aiConversationSummary, '受力分析不稳定');

  const joined = await joinStudentCourse('stu-1', 'course-joined');
  assert.equal(joined.enrollment.sessionId, 'session-joined');
  assert.equal(joined.course.source, 'joined');

  const course = await getStudentCourse('stu-1', 'course-newton-2');
  assert.equal(course.tasks[0].id, 'task-1');

  const task = await getStudentTask('stu-1', 'task-1');
  assert.equal(task.questions[0].type, 'choice');

  const answer = await saveStudentAnswer('stu-1', 'task-1', {
    questionId: 'q1',
    answer: { value: 'A' }
  });
  assert.equal(answer.answeredCount, 1);

  const result = await submitStudentTask('stu-1', 'task-1');
  assert.equal(result.status, 'completed');

  const events = [];
  await streamStudentAiChat({
    studentId: 'stu-1',
    taskId: 'task-1',
    questionId: 'q1',
    message: '提示一下'
  }, {
    onDelta: (text) => events.push({ type: 'delta', text }),
    onDone: (meta) => events.push({ type: 'done', meta })
  });
  assert.deepEqual(events, [
    { type: 'delta', text: '先分析合力' },
    { type: 'done', meta: { provider: 'deepseek' } }
  ]);

  assert.deepEqual(calls, [
    'GET /api/v1/student/courses',
    'GET /api/v1/student/dashboard',
    'GET /api/v1/student/course-catalog',
    'GET /api/v1/student/analysis',
    'GET /api/v1/student/analysis/courses/course-newton-2',
    'POST /api/v1/student/analysis/courses/course-newton-2/generate',
    'POST /api/v1/student/courses/join',
    'GET /api/v1/student/courses/course-newton-2',
    'GET /api/v1/student/tasks/task-1',
    'POST /api/v1/student/tasks/task-1/answers',
    'POST /api/v1/student/tasks/task-1/submit',
    'POST /api/v1/student/ai/chat-stream'
  ]);

  console.log('student API client contracts passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
