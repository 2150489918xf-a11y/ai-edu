import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/PptGeneratePage.vue', import.meta.url), 'utf8');
const courseAdapterSource = readFileSync(new URL('../src/data/courseUiAdapter.js', import.meta.url), 'utf8');

assert.ok(
  source.includes('loadWorkspaceCourse'),
  'PPT page should load the current route course from the course API/cache layer'
);

assert.ok(
  !/import\s*\{[^}]*\bgetCourse\b[^}]*\}\s*from ['"]\.\.\/data\/mockStore['"]/.test(source),
  'PPT page should not resolve course context through mockStore.getCourse fallback'
);

assert.ok(
  source.includes('router.push(`/preclass/courses/${courseId.value}/workspace`)'),
  'PPT back action should return to the route course workspace, not a fallback course id'
);

assert.ok(
  source.includes('course.value?.ppt?.slides'),
  'PPT page should prefer slides persisted on the current course when available'
);

assert.ok(
  source.includes('getFallbackSlideImage'),
  'PPT page should keep image-based fallback slides for the pseudo AI generation preview'
);

assert.ok(
  source.includes('imageSrc: getFallbackSlideImage('),
  'fallback PPT slides should render images instead of the plain text generated layout'
);

assert.ok(
  courseAdapterSource.includes('ppt: course.ppt || null'),
  'course UI adapter should preserve persisted PPT data from the course API response'
);

console.log('ppt generate page course context checks passed');
