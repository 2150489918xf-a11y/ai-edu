import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routerSource = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
const loginSource = readFileSync(new URL('../src/pages/LoginPage.vue', import.meta.url), 'utf8');
const authClientSource = readFileSync(new URL('../src/data/authApiClient.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

assert.ok(routerSource.includes("path: '/login'"), 'teacher login route should exist');
assert.ok(routerSource.includes("path: '/student/login'"), 'student login route should exist');
assert.ok(routerSource.includes("path: '/admin/login'"), 'admin login route should exist');
assert.ok(routerSource.includes("path: '/admin'"), 'admin office route should exist');
assert.ok(loginSource.includes('教师登录') && loginSource.includes('学生登录') && loginSource.includes('教务处登录'), 'login page should expose teacher, student, and admin modes');
assert.ok(loginSource.includes('login('), 'login page should call auth API client');
assert.ok(loginSource.includes('teacher-wang') && loginSource.includes('stu-chenyu') && loginSource.includes('admin-office'), 'login page should provide demo accounts');
assert.ok(!appSource.includes("to: '/admin'"), 'teacher navigation should not link to admin office');
assert.ok(authClientSource.includes('/auth/login'), 'auth client should call login endpoint');
assert.ok(authClientSource.includes('/auth/me'), 'auth client should call current user endpoint');
assert.ok(authClientSource.includes('localStorage'), 'auth client should persist token locally');

console.log('auth page contracts passed');
