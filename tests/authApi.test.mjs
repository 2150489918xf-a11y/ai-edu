import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createLearningApiApp } from '../server/app.js';

function createMockLearningService() {
  return {
    async getClasses() {
      return [];
    }
  };
}

function createMockAuthService() {
  return {
    async login(payload) {
      assert.equal(payload.username, 'teacher-wang');
      assert.equal(payload.password, 'teacher123');
      return {
        token: 'token-teacher',
        user: { id: 'user-teacher-wang', username: 'teacher-wang', role: 'teacher' },
        profile: { id: 'teacher-wang', name: '王老师' }
      };
    },
    async getCurrentUser(token) {
      assert.equal(token, 'token-teacher');
      return {
        user: { id: 'user-teacher-wang', username: 'teacher-wang', role: 'teacher' },
        profile: { id: 'teacher-wang', name: '王老师' }
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
  authService: createMockAuthService()
});
const { server, baseUrl } = await listen(app);

try {
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'teacher-wang', password: 'teacher123' })
  });
  const loginPayload = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.equal(loginPayload.data.token, 'token-teacher');
  assert.equal(loginPayload.data.profile.name, '王老师');

  const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: { Authorization: 'Bearer token-teacher' }
  });
  const mePayload = await meResponse.json();
  assert.equal(meResponse.status, 200);
  assert.equal(mePayload.data.user.role, 'teacher');

  console.log('auth API contracts passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
