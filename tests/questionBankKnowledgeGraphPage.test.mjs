import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const router = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/pages/QuestionBankDetailPage.vue', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/QuestionBankKnowledgeGraphPage.vue', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/data/questionBankApiClient.js', import.meta.url), 'utf8');

assert.ok(!app.includes("to: '/knowledge-graph'"));
assert.ok(!router.includes("path: '/knowledge-graph'"));
assert.ok(router.includes("path: '/question-banks/:bankId/knowledge-graph'"));
assert.ok(detail.includes('知识图谱') && detail.includes('/knowledge-graph'));
assert.ok(page.includes('KnowledgeGraphRenderer'));
assert.ok(page.includes('KnowledgeGraphInspector'));
assert.ok(page.includes('pendingCount') && page.includes('processingCount'));
assert.ok(client.includes('getQuestionBankKnowledgeGraph'));
assert.ok(client.includes('getQuestionBankKnowledgePoint'));

console.log('question bank knowledge graph page contract passed');
