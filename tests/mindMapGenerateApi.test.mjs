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
  const course = {
    id: 'course-newton-2',
    title: 'Newton Second Law',
    subject: 'Physics',
    grade: 'Grade 10',
    duration: '45 minutes',
    goal: 'Understand F=ma.',
    knowledge: ['force', 'mass', 'acceleration'],
    outline: { version: 'v1' },
    mindmap: null
  };

  return {
    async getCourse(courseId) {
      assert.equal(courseId, 'course-newton-2');
      return course;
    },
    async updateCourse(courseId, payload = {}) {
      assert.equal(courseId, 'course-newton-2');
      assert.equal(payload.mindmap.markdown, '# Newton Second Law\n## Force and acceleration');
      course.mindmap = payload.mindmap;
      return { ...course };
    }
  };
}

function createMockAiMindMapService() {
  return {
    async generateMindMap(request = {}) {
      assert.equal(request.course.id, 'course-newton-2');
      assert.equal(request.course.title, 'Newton Second Law');
      assert.equal(request.currentMarkdown, '# Existing');
      assert.equal(request.prompt, 'Generate from course basics.');
      assert.equal(request.messages[0].role, 'user');
      return {
        provider: 'deepseek',
        model: 'deepseek-chat',
        content: 'Generated.\n:::mindmap\n# Newton Second Law\n## Force and acceleration\n:::',
        markdown: '# Newton Second Law\n## Force and acceleration'
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

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  return { response, payload };
}

const app = createLearningApiApp({
  learningService: createMockLearningService(),
  courseService: createMockCourseService(),
  aiMindMapService: createMockAiMindMapService()
});
const { server, baseUrl } = await listen(app);

try {
  const result = await requestJson(baseUrl, '/api/v1/courses/course-newton-2/mindmap/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Generate from course basics.',
      currentMarkdown: '# Existing',
      messages: [{ role: 'user', content: 'Generate mind map' }]
    })
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.data.mindmap.markdown, '# Newton Second Law\n## Force and acceleration');
  assert.equal(result.payload.data.course.mindmap.markdown, '# Newton Second Law\n## Force and acceleration');
  assert.equal(result.payload.data.provider, 'deepseek');

  console.log('mind map generate API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
