import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const generateSource = readFileSync(new URL('../src/pages/QuestionGeneratePage.vue', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../src/pages/QuestionBankDetailPage.vue', import.meta.url), 'utf8');

assert.ok(
  generateSource.includes('--question-workspace-height') &&
    generateSource.includes('height: var(--question-workspace-height)'),
  'AI question generation page should give all three columns the same workspace height'
);

assert.ok(
  generateSource.includes('.generated-panel .list-panel') &&
    generateSource.includes('overflow-y: auto'),
  'generated candidate list should scroll inside the middle panel'
);

assert.ok(
  generateSource.includes('grid-template-rows: auto auto minmax(0, 1fr) auto'),
  'generated panel should keep header/footer visible while only the question list scrolls'
);

assert.ok(
  detailSource.includes('--bank-detail-workspace-height') &&
    detailSource.includes('height: var(--bank-detail-workspace-height)'),
  'question bank detail content should use a fixed workspace height below the toolbar'
);

assert.ok(
  detailSource.includes('.bank-detail-page .list-panel') &&
    detailSource.includes('overflow-y: auto'),
  'question bank detail list should scroll so lower questions remain reachable'
);

console.log('question page scroll layout contracts passed');
