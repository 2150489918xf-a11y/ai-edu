import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/admin/AdminEnrollmentsPage.vue', import.meta.url), 'utf8');

assert.ok(source.includes('assignStudentCourse') && source.includes('removeStudentCourse'), 'enrollment page should assign and remove student courses');
assert.ok(source.includes('getStudentEnrollments') && source.includes('AdminResourceDrawer'), 'enrollment details should use a drawer');
assert.ok(source.includes('listAdminStudents') && source.includes('listAdminClasses') && source.includes('listAdminCourses'));
assert.ok(source.includes('班级课程') && source.includes('个人课程') && source.includes('可分配课程'));

console.log('admin enrollment page contracts passed');
