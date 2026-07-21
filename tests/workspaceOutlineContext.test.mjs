import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mockStoreSource = readFileSync(new URL('../src/data/mockStore.js', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../src/pages/WorkspacePage.vue', import.meta.url), 'utf8');

assert.ok(
  mockStoreSource.includes('export function getOutline(courseId = store.selectedCourseId) {\n  return store.outlines[courseId] || null;\n}'),
  'missing course outlines should not fall back to the Newton demo outline'
);

assert.ok(
  !mockStoreSource.includes("store.outlines[id] = { ...store.outlines['physics-newton-2'] };"),
  'newly created courses should not be prefilled with the Newton demo outline'
);

assert.ok(
  mockStoreSource.includes("const COURSE_CHAT_STORAGE_KEY = 'eduai.mock.courseChats.v3';"),
  'workspace chat storage should be versioned so old Newton-contaminated histories are ignored'
);

assert.ok(
  workspaceSource.includes('const outline = computed(() => course.value.outline || getOutline(course.value.id));'),
  'workspace should prefer the persisted course outline before reading mock outline state'
);

assert.ok(
  workspaceSource.includes('resolveWorkspaceFallbackCourse(route.params.courseId)'),
  'API-only courses should start in a loading state instead of rendering an unrelated mock course'
);

assert.ok(
  workspaceSource.includes('v-if="!course"'),
  'workspace should render an explicit loading or error state before the API course is available'
);

assert.ok(
  workspaceSource.includes('v-if="!course.hasOutline || !outline"'),
  'a missing outline payload should use the outline generation state instead of dereferencing null'
);

assert.ok(
  workspaceSource.includes('currentOutline: course.value.hasOutline ? outline.value : null'),
  'workspace should not send a fallback outline when the current course has no outline yet'
);

console.log('workspace outline context checks passed');
