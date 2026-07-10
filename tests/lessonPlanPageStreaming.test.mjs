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

console.log('lesson plan page streaming checks passed');
