import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('../src/pages/QuestionBanksPage.vue', import.meta.url), 'utf8');

assert.ok(
  pageSource.includes('createQuestionBank'),
  'question banks page should call the create question bank API client'
);

assert.ok(
  pageSource.includes('openCreateBank'),
  'question banks page should expose a create-bank action'
);

assert.ok(
  pageSource.includes('submitBank'),
  'question banks page should submit a manual bank form'
);

assert.ok(
  pageSource.includes('新增题库') || pageSource.includes('新建题库'),
  'question banks page should show a manual add bank entry'
);

assert.ok(
  pageSource.includes('role="dialog"') && pageSource.includes('题库名称'),
  'question banks page should render a dialog form with bank title field'
);

console.log('question banks page manual create checks passed');
