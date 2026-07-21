import assert from 'node:assert/strict';

import {
  loadWorkspaceCourse,
  resolveWorkspaceFallbackCourse
} from '../src/data/workspaceCourseLoader.js';

assert.equal(
  resolveWorkspaceFallbackCourse('api-only-course', () => ({ id: 'unrelated-first-course' })),
  null,
  'an API-only course must not render an unrelated mock course while loading'
);
assert.deepEqual(
  resolveWorkspaceFallbackCourse('mock-course', () => ({ id: 'mock-course', title: 'Mock course' })),
  { id: 'mock-course', title: 'Mock course' }
);

const apiResult = await loadWorkspaceCourse('course-db-1', {
  fetchCourse: async (courseId) => ({
    id: courseId,
    title: 'Newton Second Law',
    subject: 'Physics',
    grade: 'Grade 10',
    duration: '45 minutes',
    goal: 'Understand F=ma.',
    knowledge: ['F=ma', 'net force'],
    status: 'active'
  }),
  getFallbackCourse: () => {
    throw new Error('fallback should not be used when API succeeds');
  },
  mapCourse: (course) => ({
    id: course.id,
    title: course.title,
    duration: course.duration,
    goal: course.goal,
    knowledge: course.knowledge,
    hasOutline: false
  })
});

assert.equal(apiResult.source, 'api');
assert.equal(apiResult.course.id, 'course-db-1');
assert.equal(apiResult.course.duration, '45 minutes');
assert.deepEqual(apiResult.course.knowledge, ['F=ma', 'net force']);
assert.equal(apiResult.error, null);

const fallbackCourse = { id: 'course-mock-1', title: 'Mock course', hasOutline: true };
const fallbackResult = await loadWorkspaceCourse('course-mock-1', {
  fetchCourse: async () => {
    throw new Error('not found');
  },
  getFallbackCourse: (courseId) => ({ ...fallbackCourse, id: courseId }),
  mapCourse: (course) => course
});

assert.equal(fallbackResult.source, 'mock');
assert.equal(fallbackResult.course.id, 'course-mock-1');
assert.equal(fallbackResult.course.hasOutline, true);
assert.equal(fallbackResult.error.message, 'not found');

console.log('workspace course loader contracts passed');
