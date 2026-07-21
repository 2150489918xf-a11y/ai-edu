import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  try {
    return readFileSync(new URL(path, import.meta.url), 'utf8');
  } catch {
    return '';
  }
}

const railSource = read('../src/components/CourseWorkflowRail.vue');
const pageSources = [
  ['WorkspacePage.vue', 'generate', read('../src/pages/WorkspacePage.vue')],
  ['MindMapGeneratePage.vue', 'mindmap', read('../src/pages/MindMapGeneratePage.vue')],
  ['LessonPlanPage.vue', 'lesson-plan', read('../src/pages/LessonPlanPage.vue')],
  ['StageAnalysisPage.vue', 'analysis', read('../src/pages/StageAnalysisPage.vue')]
];

for (const [label, icon, path] of [
  ['生成', 'auto_awesome', '/workspace'],
  ['导图', 'account_tree', '/mindmap'],
  ['PPT', 'desktop_windows', '/ppt'],
  ['教案', 'article', '/lesson-plan'],
  ['题析', 'analytics', '/analysis']
]) {
  assert.ok(railSource.includes(`label: '${label}'`), `shared rail should include ${label}`);
  assert.ok(railSource.includes(`icon: '${icon}'`), `shared rail should use the ${icon} icon`);
  assert.ok(railSource.includes(path), `shared rail should navigate to ${path}`);
}

assert.ok(railSource.includes('aria-current'), 'the active workflow step should be announced accessibly');
assert.ok(railSource.includes("emit('blocked'"), 'locked workflow steps should report blocked navigation');

for (const [file, activeStep, source] of pageSources) {
  assert.ok(source.includes("import CourseWorkflowRail from '../components/CourseWorkflowRail.vue'"), `${file} should import the shared rail`);
  assert.ok(source.includes('<CourseWorkflowRail'), `${file} should render the shared rail`);
  assert.ok(source.includes(`active-step="${activeStep}"`), `${file} should activate ${activeStep}`);
  assert.match(source, /grid-template-columns:\s*64px/, `${file} should reserve the shared 64px rail width`);
}

for (const [file, , source] of pageSources) {
  for (const legacyClass of ['ws-rail', 'mind-rail', 'lp-course-rail', 'qa-rail']) {
    assert.ok(!source.includes(legacyClass), `${file} should not keep the legacy ${legacyClass} implementation`);
  }
}

console.log('shared course workflow rail contracts passed');
