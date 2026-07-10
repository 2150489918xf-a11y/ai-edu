import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  getAuthToken,
  getCurrentUser,
  login,
  logout
} from '../src/data/authApiClient.js';

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

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      const body = await readJsonBody(req);
      assert.equal(body.username, 'teacher-wang');
      assert.equal(body.password, 'teacher123');
      sendJson(res, 200, {
        data: {
          token: 'token-teacher',
          user: { id: 'user-teacher-wang', role: 'teacher' },
          profile: { id: 'teacher-wang', name: '王老师' }
        }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/auth/me') {
      assert.equal(req.headers.authorization, 'Bearer token-teacher');
      sendJson(res, 200, {
        data: {
          user: { id: 'user-teacher-wang', role: 'teacher' },
          profile: { id: 'teacher-wang', name: '王老师' }
        }
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

const { server, calls, baseUrl } = await listen();
globalThis.__EDUAI_API_BASE_URL__ = baseUrl;
globalThis.localStorage = new Map();
globalThis.localStorage.getItem = globalThis.localStorage.get.bind(globalThis.localStorage);
globalThis.localStorage.setItem = globalThis.localStorage.set.bind(globalThis.localStorage);
globalThis.localStorage.removeItem = globalThis.localStorage.delete.bind(globalThis.localStorage);

try {
  const loginResult = await login({ username: 'teacher-wang', password: 'teacher123' });
  assert.equal(loginResult.profile.name, '王老师');
  assert.equal(getAuthToken(), 'token-teacher');

  const current = await getCurrentUser();
  assert.equal(current.user.role, 'teacher');

  logout();
  assert.equal(getAuthToken(), '');
  assert.deepEqual(calls, ['POST /api/v1/auth/login', 'GET /api/v1/auth/me']);

  console.log('auth client contracts passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  delete globalThis.localStorage;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
