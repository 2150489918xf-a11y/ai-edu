import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const router = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/pages/QuestionBankDetailPage.vue', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/QuestionBankKnowledgeGraphPage.vue', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../src/components/knowledge/KnowledgeGraphInspector.vue', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/data/questionBankApiClient.js', import.meta.url), 'utf8');

assert.ok(page.includes('projectKnowledgePathGraph'));
assert.ok(page.includes('pathStats'));
assert.ok(page.includes('路径节点'));
assert.ok(page.includes('路径关系'));
assert.ok(page.includes('适应画布'));
assert.ok(page.includes('重新分层'));
assert.ok(!page.includes('saveQuestionBankKnowledgeGraphLayout'));
assert.ok(!page.includes('queueLayoutChange'));
assert.ok(!page.includes('@layout-change'));
assert.ok(!page.includes('恢复自动布局'));
assert.ok(!page.includes('relationFilter'));
assert.ok(!page.includes('neighborhoodDepth'));
assert.ok(!app.includes("to: '/knowledge-graph'"));
assert.ok(!router.includes("path: '/knowledge-graph'"));
assert.ok(router.includes("path: '/question-banks/:bankId/knowledge-graph'"));
assert.ok(detail.includes('知识图谱') && detail.includes('/knowledge-graph'));
assert.ok(page.includes('KnowledgeGraphRenderer'));
assert.ok(page.includes('KnowledgeGraphInspector'));
assert.ok(page.includes('pendingCount') && page.includes('processingCount'));
assert.match(
  page,
  /\.question-graph-page\s*\{[\s\S]*height:\s*100%;[\s\S]*overflow:\s*hidden;/,
  'question graph page should fit the teacher shell instead of sizing from viewport height'
);
assert.match(
  page,
  /@media \(max-width:\s*1180px\)[\s\S]*\.question-graph-page\s*\{[\s\S]*overflow-y:\s*auto;/,
  'question graph page should own vertical scrolling when the graph and inspector stack'
);
assert.match(
  page,
  /@media \(max-width:\s*1180px\)[\s\S]*\.question-graph-page\s*\{[\s\S]*grid-template-rows:\s*auto auto auto auto;/,
  'stacked graph layout should let the inspector contribute to page scroll height'
);
assert.match(
  page,
  /@media \(max-width:\s*1180px\)[\s\S]*\.question-graph-page\s*\{[\s\S]*align-content:\s*start;/,
  'stacked graph layout should not stretch auto rows into clipped tracks'
);
assert.match(
  inspector,
  /@media \(max-width:\s*1080px\)[\s\S]*\.graph-inspector\s*\{[\s\S]*max-height:\s*none;[\s\S]*overflow:\s*visible;/,
  'stacked inspector should grow with content instead of hiding its lower actions'
);
assert.ok(client.includes('getQuestionBankKnowledgeGraph'));
assert.ok(client.includes('getQuestionBankKnowledgePoint'));

console.log('question bank knowledge graph page contract passed');
