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

function createMockAiOutlineService() {
  return {
    async generateOutlineReply(payload) {
      assert.equal(payload.course.title, '牛顿第二定律');
      return {
        content: '已生成课程大纲。\n:::outline-json\n{"version":"v1","tags":["物理"],"sections":[{"id":"intro","phase":"导入","time":"0-5 分钟","title":"情境导入","status":"optimized","active":true,"cards":[{"label":"教师动作","content":"展示实验情境","tone":"focus"}]}]}\n:::',
        provider: 'deepseek',
        model: 'deepseek-chat'
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

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  aiOutlineService: createMockAiOutlineService()
});
const { server, baseUrl } = await listen(app);

try {
  const response = await fetch(`${baseUrl}/api/outline-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course: { title: '牛顿第二定律' },
      messages: [{ role: 'user', content: '生成大纲' }]
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.model, 'deepseek-chat');
  assert.ok(body.content.includes(':::outline-json'));
  assert.ok(body.content.includes('情境导入'));

  console.log('AI outline agent API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
