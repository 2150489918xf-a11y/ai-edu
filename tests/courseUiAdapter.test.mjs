import assert from 'node:assert/strict';

import { mapApiCourseToUiCourse } from '../src/data/courseUiAdapter.js';

const activeCourse = mapApiCourseToUiCourse({
  id: 'course-newton-2',
  title: '牛顿第二定律',
  subject: '物理',
  grade: '高一',
  description: 'F=ma 与合外力计算',
  status: 'active',
  updatedAt: '2026-07-07T09:00:00.000Z'
});

assert.equal(activeCourse.id, 'course-newton-2');
assert.equal(activeCourse.shortTitle, '高一 · 牛顿第二定律');
assert.equal(activeCourse.status, '进行中');
assert.equal(activeCourse.statusTone, 'normal');
assert.deepEqual(activeCourse.tags, ['高一', '物理', '45 min']);
assert.equal(activeCourse.duration, '45 分钟');
assert.ok(activeCourse.summary.includes('F=ma'));
assert.ok(activeCourse.knowledge.length >= 1);

const archivedCourse = mapApiCourseToUiCourse({
  id: 'course-archived',
  title: '旧课程',
  subject: '数学',
  grade: '高一',
  description: '',
  status: 'archived',
  deletedAt: '2026-07-07T09:10:00.000Z'
});

assert.equal(archivedCourse.status, '已归档');
assert.equal(archivedCourse.statusTone, 'warn');

console.log('course UI adapter contracts passed');
