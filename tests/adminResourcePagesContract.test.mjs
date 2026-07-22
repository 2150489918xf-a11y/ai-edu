import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/pages/admin/${name}`, import.meta.url), 'utf8');
const students = read('AdminStudentsPage.vue');
const classes = read('AdminClassesPage.vue');
const courses = read('AdminCoursesPage.vue');

for (const [name, source] of [['students', students], ['classes', classes], ['courses', courses]]) {
  assert.ok(source.includes('admin-filters'), `${name} should use the shared single-row filter layout`);
  assert.ok(source.includes('AdminResourceDrawer'), `${name} should use resource drawer`);
  assert.ok(source.includes('AdminConfirmDialog'), `${name} should confirm archive`);
  assert.ok(source.includes('AdminPagination'), `${name} should paginate`);
  assert.ok(source.includes('status'), `${name} should filter status`);
  assert.ok(source.includes('restoreAdmin'), `${name} should restore archived rows`);
}

assert.ok(students.includes('listAdminStudents') && students.includes('createAdminStudent') && students.includes('updateAdminStudent'));
assert.ok(students.includes('classId') && students.includes('username') && students.includes('studentNo'));
assert.ok(classes.includes('listAdminClasses') && classes.includes('createAdminClass') && classes.includes('updateAdminClass'));
assert.ok(classes.includes('teacherId') && classes.includes('studentCount') && classes.includes('sessionCount'));
assert.ok(courses.includes('listAdminCourses') && courses.includes('createAdminCourse') && courses.includes('updateAdminCourse'));
assert.ok(courses.includes('teacherId') && courses.includes('subject') && courses.includes('grade') && courses.includes('duration'));

console.log('admin resource page contracts passed');
