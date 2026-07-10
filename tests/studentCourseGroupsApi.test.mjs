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
    async listCourseGroups(studentId) {
      assert.equal(studentId, 'stu-1');
      return {
        student: { id: 'stu-1', name: '陈雨', className: '高一 3 班' },
        courses: [
          {
            id: 'group-physics-grade1',
            title: '高一物理',
            subject: '物理',
            grade: '高一',
            unitCount: 3,
            taskCount: 2,
            answeredQuestionCount: 4,
            questionCount: 8,
            progress: 50
          }
        ]
      };
    },
    async getCourseGroup(studentId, groupId) {
      assert.equal(studentId, 'stu-1');
      assert.equal(groupId, 'group-physics-grade1');
      return {
        id: groupId,
        title: '高一物理',
        subject: '物理',
        grade: '高一',
        unitCount: 3,
        taskCount: 2,
        progress: 50,
        units: [{ id: 'course-newton-2', title: '牛顿第二定律', taskCount: 1, progress: 75 }],
        tasks: [{ id: 'session-1', courseId: 'course-newton-2', title: '牛顿第二定律 课堂练习', questionCount: 4 }]
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

async function requestJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { response, payload: await response.json() };
}

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  studentLearningService: createMockStudentLearningService()
});
const { server, baseUrl } = await listen(app);

try {
  const list = await requestJson(baseUrl, '/api/v1/student/course-groups?studentId=stu-1');
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data.courses[0].title, '高一物理');
  assert.equal(list.payload.data.courses[0].unitCount, 3);

  const detail = await requestJson(baseUrl, '/api/v1/student/course-groups/group-physics-grade1?studentId=stu-1');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.data.units[0].id, 'course-newton-2');
  assert.equal(detail.payload.data.tasks[0].questionCount, 4);

  console.log('student course group API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
