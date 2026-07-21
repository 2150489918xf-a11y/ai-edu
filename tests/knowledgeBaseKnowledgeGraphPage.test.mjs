import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
const knowledgeBasePage = readFileSync(new URL('../src/pages/KnowledgeBasePage.vue', import.meta.url), 'utf8');
const graphPage = readFileSync(new URL('../src/pages/KnowledgeBaseKnowledgeGraphPage.vue', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/components/knowledge/KnowledgeBaseGraphDetail.vue', import.meta.url), 'utf8');

assert.ok(router.includes("path: '/knowledge-base/knowledge-graph'"));
assert.ok(router.includes('KnowledgeBaseKnowledgeGraphPage'));
assert.ok(knowledgeBasePage.includes("router.push('/knowledge-base/knowledge-graph')"));
assert.ok(knowledgeBasePage.includes('知识图谱'));
assert.ok(graphPage.includes('KnowledgeGraphRenderer'));
assert.ok(graphPage.includes('KnowledgeBaseGraphDetail'));
assert.ok(graphPage.includes('knowledgeBaseGraphData'));
assert.ok(graphPage.includes('重新分层'));
assert.ok(graphPage.includes('适应画布'));
assert.ok(graphPage.includes('count-unit="条资料"'));
assert.ok(graphPage.includes('关联资料越多，节点证据越充分'));
assert.ok(!graphPage.includes('getQuestionBankKnowledgeGraph'));
assert.ok(!graphPage.includes('saveQuestionBankKnowledgeGraphLayout'));
assert.ok(!graphPage.includes('analyzePendingQuestionKnowledge'));
assert.ok(detail.includes('引用资料'));
assert.ok(detail.includes('前置知识'));
assert.ok(detail.includes('后续路径'));
assert.ok(!detail.includes("emit('save-node'"));
assert.match(
  graphPage,
  /@media \(max-width:\s*1180px\)[\s\S]*\.knowledge-base-graph-page\s*\{[\s\S]*overflow-y:\s*auto;/,
  'stacked knowledge base graph page should own vertical scrolling'
);

console.log('knowledge base knowledge graph page contract passed');
