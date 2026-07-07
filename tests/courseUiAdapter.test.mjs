import assert from 'node:assert/strict';

import { mapApiCourseToUiCourse } from '../src/data/courseUiAdapter.js';

const activeCourse = mapApiCourseToUiCourse({
  id: 'course-newton-2',
  title: 'Newton Second Law',
  subject: 'Physics',
  grade: 'Grade 10',
  duration: '50 minutes',
  goal: 'Understand F=ma and complete basic calculations.',
  knowledge: ['F=ma', 'net force calculation'],
  hasOutline: true,
  progress: 58,
  materialUploaded: true,
  materialName: 'newton-source.pdf',
  outline: { version: 'v1' },
  description: 'F=ma and net force calculation',
  status: 'active',
  updatedAt: '2026-07-07T09:00:00.000Z'
});

assert.equal(activeCourse.id, 'course-newton-2');
assert.equal(activeCourse.shortTitle, 'Grade 10 · Newton Second Law');
assert.equal(activeCourse.status, '进行中');
assert.equal(activeCourse.statusTone, 'normal');
assert.deepEqual(activeCourse.tags, ['Grade 10', 'Physics', '50 minutes']);
assert.equal(activeCourse.duration, '50 minutes');
assert.equal(activeCourse.goal, 'Understand F=ma and complete basic calculations.');
assert.deepEqual(activeCourse.knowledge, ['F=ma', 'net force calculation']);
assert.equal(activeCourse.hasOutline, true);
assert.equal(activeCourse.progress, 58);
assert.equal(activeCourse.materialUploaded, true);
assert.equal(activeCourse.materialName, 'newton-source.pdf');
assert.equal(activeCourse.outline.version, 'v1');
assert.ok(activeCourse.summary.includes('F=ma'));

const archivedCourse = mapApiCourseToUiCourse({
  id: 'course-archived',
  title: 'Archived course',
  subject: 'Math',
  grade: 'Grade 10',
  description: '',
  status: 'archived',
  deletedAt: '2026-07-07T09:10:00.000Z'
});

assert.equal(archivedCourse.status, '已归档');
assert.equal(archivedCourse.statusTone, 'warn');

console.log('course UI adapter contracts passed');
