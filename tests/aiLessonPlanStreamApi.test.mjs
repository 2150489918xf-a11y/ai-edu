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

function createMockCourseService() {
  return {
    async getCourse(courseId) {
      assert.equal(courseId, 'course-lesson');
      return {
        id: courseId,
        title: '高中物理《牛顿第二定律》',
        grade: '高一',
        subject: '物理',
        duration: '45 分钟',
        goal: '理解力、质量与加速度关系。',
        outline: { version: 'v1', sections: [] },
        progress: 58
      };
    },
    async updateCourse(courseId, patch) {
      assert.equal(courseId, 'course-lesson');
      assert.equal(patch.lessonPlan.steps[0].title, '情境导入');
      assert.equal(patch.progress, 78);
      return { id: courseId, ...patch };
    }
  };
}

function createMockAiLessonPlanService() {
  return {
    async streamLessonPlan(payload, handlers) {
      assert.equal(payload.course.id, 'course-lesson');
      assert.equal(payload.prompt, 'stream lesson plan');
      handlers.onDelta('正在生成教案。');
      handlers.onMeta({ grade: '高一', subject: '物理', duration: '45 分钟' });
      handlers.onSection({
        id: 'intro',
        title: '情境导入',
        time: "0-5'",
        intent: '激活经验。',
        teacher: ['展示情境'],
        student: ['观察现象'],
        board: '问题',
        check: '能提出猜想'
      });
      handlers.onLessonPlan({
        version: 'v1',
        meta: { grade: '高一', subject: '物理', duration: '45 分钟' },
        objectives: [],
        materials: [],
        focus: [],
        difficulties: [],
        steps: [{
          id: 'intro',
          title: '情境导入',
          time: "0-5'",
          intent: '激活经验。',
          teacher: ['展示情境'],
          student: ['观察现象'],
          board: '问题',
          check: '能提出猜想'
        }],
        closing: []
      });
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

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  courseService: createMockCourseService(),
  aiLessonPlanService: createMockAiLessonPlanService()
});
const { server, baseUrl } = await listen(app);

try {
  const response = await fetch(`${baseUrl}/api/v1/courses/course-lesson/lesson-plan/generate-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'stream lesson plan' })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.ok(body.includes('event: delta'));
  assert.ok(body.includes('"text":"正在生成教案。"'));
  assert.ok(body.includes('event: meta'));
  assert.ok(body.includes('"subject":"物理"'));
  assert.ok(body.includes('event: section'));
  assert.ok(body.includes('"title":"情境导入"'));
  assert.ok(body.includes('event: lessonPlan'));
  assert.ok(body.includes('event: done'));

  console.log('AI lesson plan stream API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
