import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coursesSource = readFileSync(new URL('../src/pages/CoursesPage.vue', import.meta.url), 'utf8');
const adapterSource = readFileSync(new URL('../src/data/courseUiAdapter.js', import.meta.url), 'utf8');
const courseServiceSource = readFileSync(new URL('../server/services/courseService.js', import.meta.url), 'utf8');

assert.ok(coursesSource.includes('我的备课'), 'teacher course page should use preparation wording');
assert.ok(coursesSource.includes('新建备课单元'), 'teacher course page should create course units, not real courses');
assert.ok(coursesSource.includes('新建课程分组') && coursesSource.includes('showCreateGroupDialog'), 'teacher course page should support manually creating course groups');
assert.ok(coursesSource.includes('courseGroups') && coursesSource.includes('groupedCourses'), 'teacher course page should group units by real course');
assert.ok(coursesSource.includes('selectedGroupId') && coursesSource.includes('course-group-filter'), 'teacher course page should filter units by course group');
assert.ok(coursesSource.includes('所属课程') && coursesSource.includes('createForm.groupId'), 'create dialog should allow selecting a parent course');
assert.ok(coursesSource.includes('备课单元名称'), 'create dialog should name the unit field clearly');
assert.ok(adapterSource.includes('groupTitle') && adapterSource.includes('groupId'), 'course UI adapter should expose group metadata');
assert.ok(courseServiceSource.includes('resolveCourseGroupId') && courseServiceSource.includes('include:') && courseServiceSource.includes('group:'), 'course service should return and resolve course group metadata');
assert.ok(courseServiceSource.includes('createCourseGroup') && courseServiceSource.includes('listCourseGroups'), 'course service should support course group creation and listing');
assert.ok(coursesSource.includes('confirmDeleteGroup') && coursesSource.includes('deleteCourseGroup'), 'teacher course page should delete empty course groups');
assert.ok(coursesSource.includes('confirmDeleteCourse') && coursesSource.includes('deleteCoursePermanently'), 'teacher course page should permanently delete course units');
assert.ok(coursesSource.includes('永久删除') && coursesSource.includes('group.count > 0'), 'teacher course page should expose destructive copy and disable deletion for non-empty groups');
assert.ok(coursesSource.includes('unitCount: group.unitCount'), 'group deletion guard should use the server total including archived units');
assert.ok(courseServiceSource.includes('deleteCourseGroup') && courseServiceSource.includes('COURSE_GROUP_NOT_EMPTY'), 'course service should reject deletion of non-empty groups');
assert.ok(courseServiceSource.includes('deleteCoursePermanently') && courseServiceSource.includes('$transaction'), 'course service should permanently delete a unit in a transaction');

console.log('teacher course units page contracts passed');
