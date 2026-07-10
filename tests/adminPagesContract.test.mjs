import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routerSource = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
const adminPageSource = readFileSync(new URL('../src/pages/admin/AdminOfficePage.vue', import.meta.url), 'utf8');
const adminClientSource = readFileSync(new URL('../src/data/adminApiClient.js', import.meta.url), 'utf8');
const studentCoursesSource = readFileSync(new URL('../src/pages/student/StudentCoursesPage.vue', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

assert.ok(routerSource.includes("path: '/admin'"), 'admin office route should exist');
assert.ok(routerSource.includes("path: '/admin/login'"), 'admin login route should exist');
assert.ok(routerSource.includes("role !== 'admin'"), 'admin route should require admin role');
assert.ok(adminPageSource.includes('教学组织管理台'), 'admin page should render an office dashboard');
assert.ok(adminPageSource.includes('教师管理') && adminPageSource.includes('学生管理') && adminPageSource.includes('课程分配'), 'admin page should manage teachers, students, and course assignments');
assert.ok(adminPageSource.includes('assignStudentCourse') && adminPageSource.includes('removeStudentCourse'), 'admin page should assign and remove student courses');
assert.ok(adminPageSource.includes("router.replace('/admin/login')"), 'admin logout should return to admin login');
assert.ok(adminClientSource.includes('/admin/teachers'), 'admin client should call teacher management endpoints');
assert.ok(adminClientSource.includes('/admin/students/') && adminClientSource.includes('/enrollments'), 'admin client should call student enrollment endpoints');
assert.ok(!appSource.includes("to: '/admin'"), 'teacher app navigation should not expose admin office');
assert.ok(!studentCoursesSource.includes("to: '/admin'"), 'student app should not expose admin office');

console.log('admin page contracts passed');
