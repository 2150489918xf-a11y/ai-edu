import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const renderer = readFileSync(new URL('../src/components/knowledge/KnowledgeGraphRenderer.vue', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../src/components/knowledge/KnowledgeGraphInspector.vue', import.meta.url), 'utf8');

assert.ok(renderer.includes("emit('select-node'"));
assert.ok(renderer.includes("emit('select-edge'"));
assert.ok(renderer.includes("emit('layout-change'"));
assert.ok(renderer.includes('questionCount'));
assert.ok(renderer.includes('supportCount'));
assert.ok(renderer.includes('co_occurrence'));
assert.ok(inspector.includes("emit('save-node'"));
assert.ok(inspector.includes("emit('merge-node'"));
assert.ok(inspector.includes("emit('create-relation'"));
assert.ok(inspector.includes('关联题目'));

console.log('question knowledge graph renderer contracts passed');
