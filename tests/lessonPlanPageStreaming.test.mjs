import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/LessonPlanPage.vue', import.meta.url), 'utf8');

assert.ok(
  source.includes('streamLessonPlan'),
  'lesson plan page should call the real streaming lesson plan client'
);

assert.ok(
  source.includes('applyLessonPlanEvent') || source.includes('onSection'),
  'lesson plan page should update the lesson plan from streaming events'
);

assert.ok(
  source.includes('generatedLessonPlan'),
  'lesson plan page should render generated lesson plan state instead of static mock sections'
);

assert.ok(
  source.includes('getLessonPlanAssistantText'),
  'lesson plan page should hide structured lesson JSON from the chat bubble'
);

assert.ok(
  source.includes('if (!generatedLessonPlan.value) generatedLessonPlan.value = createEmptyLessonPlan();'),
  'lesson plan page should not clear an existing generated lesson before AI revision streams back'
);

assert.ok(
  source.includes('shouldStartLessonPlanGeneration'),
  'lesson plan page should not turn a normal chat message into an empty lesson plan skeleton'
);

assert.ok(
  source.includes('hasRenderableLessonPlan'),
  'lesson plan page should ignore stale empty lesson plan skeletons loaded from persistence'
);

assert.ok(
  !source.includes('window.setTimeout(() => {'),
  'lesson plan generation should not be simulated with a local timeout'
);

assert.ok(
  !source.includes("import { lessonCards, lessonSections, lessonSteps } from '../data/lessonPlanMock'"),
  'lesson plan page should not render the old fixed lesson mock as the generated result'
);

assert.ok(
  !/import\s*\{[^}]*\bgetCourse\b[^}]*\}\s*from ['"]\.\.\/data\/mockStore['"]/.test(source),
  'lesson plan page should not import mockStore course fallback data'
);

assert.ok(
  !/import\s*\{[^}]*\bgetOutline\b[^}]*\}\s*from ['"]\.\.\/data\/mockStore['"]/.test(source),
  'lesson plan page should not import mockStore outline fallback data'
);

assert.ok(
  !source.includes('createCourse'),
  'lesson plan page should not create a database course from fallback mock data'
);

assert.ok(
  !source.includes('courseDetail.value ||'),
  'lesson plan page should render only the database course detail, not fallback mock course detail'
);

assert.ok(
  !source.includes('course.value?.lessonPlan'),
  'lesson plan page should not restore a lesson plan from local fallback course data after API failure'
);

console.log('lesson plan page streaming checks passed');
