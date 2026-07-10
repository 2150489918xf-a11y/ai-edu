import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coursesSource = readFileSync(new URL('../src/pages/CoursesPage.vue', import.meta.url), 'utf8');
const adapterSource = readFileSync(new URL('../src/data/courseUiAdapter.js', import.meta.url), 'utf8');
const courseServiceSource = readFileSync(new URL('../server/services/courseService.js', import.meta.url), 'utf8');

assert.ok(coursesSource.includes('我的备课'), 'teacher course page should use preparation wording');
assert.ok(coursesSource.includes('新建备课单元'), 'teacher course page should create course units, not real courses');
assert.ok(coursesSource.includes('courseGroups') && coursesSource.includes('groupedCourses'), 'teacher course page should group units by real course');
assert.ok(coursesSource.includes('selectedGroupId') && coursesSource.includes('course-group-filter'), 'teacher course page should filter units by course group');
assert.ok(coursesSource.includes('所属课程') && coursesSource.includes('createForm.groupId'), 'create dialog should allow selecting a parent course');
assert.ok(coursesSource.includes('备课单元名称'), 'create dialog should name the unit field clearly');
assert.ok(adapterSource.includes('groupTitle') && adapterSource.includes('groupId'), 'course UI adapter should expose group metadata');
assert.ok(courseServiceSource.includes('resolveCourseGroupId') && courseServiceSource.includes('include:') && courseServiceSource.includes('group:'), 'course service should return and resolve course group metadata');

console.log('teacher course units page contracts passed');
