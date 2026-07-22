import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routerSource = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
const overviewSource = readFileSync(new URL('../src/pages/admin/AdminOverviewPage.vue', import.meta.url), 'utf8');
const teachersSource = readFileSync(new URL('../src/pages/admin/AdminTeachersPage.vue', import.meta.url), 'utf8');
const adminClientSource = readFileSync(new URL('../src/data/adminApiClient.js', import.meta.url), 'utf8');
const studentCoursesSource = readFileSync(new URL('../src/pages/student/StudentCoursesPage.vue', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

assert.ok(routerSource.includes("path: '/admin'"), 'admin office route should exist');
assert.ok(routerSource.includes("path: '/admin/login'"), 'admin login route should exist');
assert.ok(routerSource.includes("role !== 'admin'"), 'admin route should require admin role');
assert.ok(overviewSource.includes('getAdminSummary') && overviewSource.includes('summaryItems'), 'overview should render real summary metrics');
assert.ok(overviewSource.includes('/admin/teachers') && overviewSource.includes('/admin/enrollments'), 'overview should expose management shortcuts');
assert.ok(teachersSource.includes('listAdminTeachers') && teachersSource.includes('createAdminTeacher'), 'teacher page should list and create teachers');
assert.ok(teachersSource.includes('updateAdminTeacher') && teachersSource.includes('archiveAdminTeacher') && teachersSource.includes('restoreAdminTeacher'), 'teacher page should edit, archive, and restore teachers');
assert.ok(teachersSource.includes('AdminResourceDrawer') && teachersSource.includes('AdminConfirmDialog'), 'teacher mutations should use shared drawer and confirmation dialog');
assert.ok(adminClientSource.includes('/admin/teachers'), 'admin client should call teacher management endpoints');
assert.ok(adminClientSource.includes('/admin/students/') && adminClientSource.includes('/enrollments'), 'admin client should call student enrollment endpoints');
assert.ok(!appSource.includes("to: '/admin'"), 'teacher app navigation should not expose admin office');
assert.ok(!studentCoursesSource.includes("to: '/admin'"), 'student app should not expose admin office');

console.log('admin page contracts passed');
