import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockLearningService() {
  return {
    async getClasses() {
      return [];
    },
    async getStudents() {
      return { classes: [], students: [], total: 0 };
    }
  };
}

function createMockStudentLearningService() {
  return {
    async getDashboard(studentId) {
      assert.equal(studentId, 'stu-1');
      return {
        student: {
          id: 'stu-1',
          name: '陈宇',
          studentNo: 'S20260103',
          classId: 'class-1',
          className: '高一 3 班',
          grade: '高一',
          subject: '物理',
          teacher: '王老师'
        },
        courses: [
          {
            id: 'course-newton-2',
            title: '牛顿第二定律',
            subject: '物理',
            grade: '高一',
            teacher: '王老师',
            nextLessonAt: '2026-07-11T08:00:00.000Z',
            taskCount: 1,
            pendingTaskCount: 1,
            progress: 40,
            source: 'class'
          }
        ]
      };
    },
    async listCourses(studentId) {
      assert.equal(studentId, 'stu-1');
      return [
        {
          id: 'course-newton-2',
          title: '牛顿第二定律',
          subject: '物理',
          grade: '高一',
          teacher: '王老师',
          nextLessonAt: '2026-07-11T08:00:00.000Z',
          taskCount: 1,
          pendingTaskCount: 1,
          progress: 40
        }
      ];
    },
    async listCourseCatalog(studentId) {
      assert.equal(studentId, 'stu-1');
      return [
        {
          id: 'course-newton-2',
          title: '牛顿第二定律',
          subject: '物理',
          grade: '高一',
          teacher: '王老师',
          questionCount: 2,
          source: 'class',
          joined: true
        },
        {
          id: 'course-force',
          title: '力的合成',
          subject: '物理',
          grade: '高一',
          teacher: '王老师',
          questionCount: 3,
          source: 'available',
          joined: false
        }
      ];
    },
    async joinCourse(studentId, payload) {
      assert.equal(studentId, 'stu-1');
      assert.equal(payload.courseId, 'course-joined');
      return {
        enrollment: {
          id: 'enroll-1',
          studentId,
          courseId: 'course-joined',
          sessionId: 'session-joined',
          status: 'active'
        },
        course: {
          id: 'course-joined',
          title: '力的合成',
          subject: '物理',
          grade: '高一',
          teacher: '任课老师',
          taskCount: 1,
          pendingTaskCount: 1,
          progress: 0,
          source: 'joined'
        }
      };
    },
    async getCourse(studentId, courseId) {
      assert.equal(studentId, 'stu-1');
      assert.equal(courseId, 'course-newton-2');
      return {
        id: courseId,
        title: '牛顿第二定律',
        subject: '物理',
        grade: '高一',
        description: '理解 F=ma 的应用',
        tasks: [
          {
            id: 'session-newton-001',
            title: '随堂练习',
            type: 'practice',
            status: 'in_progress',
            questionCount: 2,
            answeredCount: 1
          }
        ]
      };
    },
    async getTask(studentId, taskId) {
      assert.equal(studentId, 'stu-1');
      assert.equal(taskId, 'session-newton-001');
      return {
        id: taskId,
        courseId: 'course-newton-2',
        title: '随堂练习',
        status: 'in_progress',
        questions: [
          {
            id: 'q-choice',
            type: 'choice',
            title: '物体受合力 6N，质量 2kg，加速度是多少？',
            options: ['A. 2m/s²', 'B. 3m/s²'],
            studentAnswer: { value: 'B. 3m/s²' }
          },
          {
            id: 'q-blank',
            type: 'blank',
            title: '牛顿第二定律的公式是 ____。',
            options: [],
            studentAnswer: null
          }
        ]
      };
    },
    async saveAnswer(studentId, taskId, payload) {
      assert.equal(studentId, 'stu-1');
      assert.equal(taskId, 'session-newton-001');
      assert.equal(payload.questionId, 'q-blank');
      assert.deepEqual(payload.answer, { value: 'F=ma' });
      return {
        questionId: 'q-blank',
        answer: { value: 'F=ma' },
        answeredCount: 2,
        totalCount: 2
      };
    },
    async submitTask(studentId, taskId) {
      assert.equal(studentId, 'stu-1');
      assert.equal(taskId, 'session-newton-001');
      return {
        id: taskId,
        status: 'completed',
        score: 1,
        totalScore: 2,
        accuracy: 50
      };
    }
  };
}

function createMockAiStudentTutorService() {
  return {
    async streamChat(payload, handlers) {
      assert.equal(payload.studentId, 'stu-1');
      assert.equal(payload.taskId, 'session-newton-001');
      assert.equal(payload.question.id, 'q-choice');
      assert.equal(payload.message, '这题怎么想？');
      handlers.onDelta('先看合力和质量，');
      handlers.onDelta('再用 F=ma 推出加速度。');
      handlers.onDone({ provider: 'deepseek', model: 'deepseek-chat' });
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

async function readJson(response) {
  return response.json();
}

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  studentLearningService: createMockStudentLearningService(),
  aiStudentTutorService: createMockAiStudentTutorService()
});
const { server, baseUrl } = await listen(app);

try {
  const coursesResponse = await fetch(`${baseUrl}/api/v1/student/courses?studentId=stu-1`);
  const coursesPayload = await readJson(coursesResponse);
  assert.equal(coursesResponse.status, 200);
  assert.equal(coursesPayload.data[0].title, '牛顿第二定律');
  assert.equal(coursesPayload.data[0].pendingTaskCount, 1);

  const dashboardResponse = await fetch(`${baseUrl}/api/v1/student/dashboard?studentId=stu-1`);
  const dashboardPayload = await readJson(dashboardResponse);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardPayload.data.student.name, '陈宇');
  assert.equal(dashboardPayload.data.student.className, '高一 3 班');
  assert.equal(dashboardPayload.data.courses[0].teacher, '王老师');

  const catalogResponse = await fetch(`${baseUrl}/api/v1/student/course-catalog?studentId=stu-1`);
  const catalogPayload = await readJson(catalogResponse);
  assert.equal(catalogResponse.status, 200);
  assert.equal(catalogPayload.data[0].source, 'class');
  assert.equal(catalogPayload.data[1].joined, false);

  const joinResponse = await fetch(`${baseUrl}/api/v1/student/courses/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'stu-1',
      courseId: 'course-joined'
    })
  });
  const joinPayload = await readJson(joinResponse);
  assert.equal(joinResponse.status, 200);
  assert.equal(joinPayload.data.enrollment.sessionId, 'session-joined');
  assert.equal(joinPayload.data.course.source, 'joined');

  const courseResponse = await fetch(`${baseUrl}/api/v1/student/courses/course-newton-2?studentId=stu-1`);
  const coursePayload = await readJson(courseResponse);
  assert.equal(courseResponse.status, 200);
  assert.equal(coursePayload.data.tasks[0].id, 'session-newton-001');

  const taskResponse = await fetch(`${baseUrl}/api/v1/student/tasks/session-newton-001?studentId=stu-1`);
  const taskPayload = await readJson(taskResponse);
  assert.equal(taskResponse.status, 200);
  assert.deepEqual(taskPayload.data.questions.map((question) => question.type), ['choice', 'blank']);
  assert.equal(taskPayload.data.questions[0].studentAnswer.value, 'B. 3m/s²');

  const answerResponse = await fetch(`${baseUrl}/api/v1/student/tasks/session-newton-001/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'stu-1',
      questionId: 'q-blank',
      answer: { value: 'F=ma' }
    })
  });
  const answerPayload = await readJson(answerResponse);
  assert.equal(answerResponse.status, 200);
  assert.equal(answerPayload.data.answeredCount, 2);

  const submitResponse = await fetch(`${baseUrl}/api/v1/student/tasks/session-newton-001/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'stu-1' })
  });
  const submitPayload = await readJson(submitResponse);
  assert.equal(submitResponse.status, 200);
  assert.equal(submitPayload.data.status, 'completed');
  assert.equal(submitPayload.data.accuracy, 50);

  const chatResponse = await fetch(`${baseUrl}/api/v1/student/ai/chat-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'stu-1',
      taskId: 'session-newton-001',
      question: { id: 'q-choice', title: '物体受合力 6N，质量 2kg，加速度是多少？' },
      message: '这题怎么想？'
    })
  });
  const chatBody = await chatResponse.text();
  assert.equal(chatResponse.status, 200);
  assert.equal(chatResponse.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.ok(chatBody.includes('event: delta'));
  assert.ok(chatBody.includes('先看合力和质量'));
  assert.ok(chatBody.includes('event: done'));
  assert.ok(chatBody.includes('"provider":"deepseek"'));

  console.log('Student learning API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
