import assert from 'node:assert/strict';

import { projectKnowledgePathGraph } from '../src/components/knowledge/knowledgePathProjection.js';

const graph = projectKnowledgePathGraph({
  nodes: [
    { id: 'base', label: '加速度', questionCount: 4 },
    { id: 'law', label: '牛顿第二定律', questionCount: 8 },
    { id: 'method', label: '受力分析', questionCount: 6 },
    { id: 'orphan', label: '未归类概念', questionCount: 1 }
  ],
  edges: [
    { id: 'e1', source: 'base', target: 'law', type: 'prerequisite', label: '前置知识' },
    { id: 'e2', source: 'law', target: 'method', type: 'application', label: '应用于' },
    { id: 'e3', source: 'base', target: 'method', type: 'co_occurrence', label: '共同考查' },
    { id: 'e4', source: 'law', target: 'method', type: 'related', label: '相关' }
  ]
});

assert.deepEqual(graph.nodes.map((node) => node.id), ['base', 'law', 'method', 'orphan']);
assert.deepEqual(graph.edges.map((edge) => edge.id), ['e1', 'e2']);
assert.equal(graph.nodes.find((node) => node.id === 'orphan').orphan, true);
assert.equal(graph.nodes.find((node) => node.id === 'base').layer, 0);
assert.equal(graph.nodes.find((node) => node.id === 'law').layer, 1);
assert.equal(graph.nodes.find((node) => node.id === 'method').layer, 2);

const cyclic = projectKnowledgePathGraph({
  nodes: [{ id: 'c', label: 'C' }, { id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
  edges: [
    { id: 'z', source: 'c', target: 'a', type: 'application', supportCount: 1 },
    { id: 'a', source: 'a', target: 'b', type: 'prerequisite', supportCount: 3 },
    { id: 'b', source: 'b', target: 'c', type: 'derivation', supportCount: 2 },
    { id: 'duplicate', source: 'a', target: 'b', type: 'prerequisite', supportCount: 1 },
    { id: 'self', source: 'a', target: 'a', type: 'application' }
  ]
});

assert.deepEqual(cyclic.edges.map((edge) => edge.id), ['a', 'b']);
assert.deepEqual(cyclic.nodes.map((node) => node.id), ['a', 'b', 'c']);
assert.deepEqual(cyclic.nodes.map((node) => node.layer), [0, 1, 2]);

const stable = projectKnowledgePathGraph({
  nodes: [
    { id: 'method', label: '受力分析', category: '方法' },
    { id: 'orphan', label: '待归类', category: '其他' },
    { id: 'law', label: '牛顿第二定律', category: '规律' },
    { id: 'base', label: '加速度', category: '基础' }
  ],
  edges: [
    { id: 'later', source: 'law', target: 'method', type: 'application' },
    { id: 'first', source: 'base', target: 'law', type: 'prerequisite' }
  ]
});

assert.deepEqual(stable.nodes.map((node) => node.id), ['base', 'law', 'method', 'orphan']);
assert.deepEqual(stable.edges.map((edge) => edge.id), ['first', 'later']);

console.log('question knowledge path projection tests passed');
