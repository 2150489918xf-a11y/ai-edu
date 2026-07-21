import assert from 'node:assert/strict';

import { projectTeachingPathGraph } from '../src/components/knowledge/teachingPathProjection.js';
import {
  knowledgeBaseGraphData,
  knowledgeBaseGraphSummary
} from '../src/data/knowledgeBaseGraphMock.js';

assert.equal(knowledgeBaseGraphSummary.title, '高中物理知识体系');
assert.equal(knowledgeBaseGraphSummary.materialCount, 12);
assert.ok(knowledgeBaseGraphData.nodes.length >= 16);
assert.ok(knowledgeBaseGraphData.edges.length >= 18);

const nodeIds = new Set(knowledgeBaseGraphData.nodes.map((node) => node.id));
assert.equal(nodeIds.size, knowledgeBaseGraphData.nodes.length);
assert.ok(knowledgeBaseGraphData.nodes.every((node) => (
  node.label &&
  node.category &&
  node.description &&
  Number(node.questionCount) > 0 &&
  Array.isArray(node.aliases) &&
  node.aliases.length > 0 &&
  Array.isArray(node.materialRefs) &&
  node.materialRefs.length > 0
)));
assert.ok(knowledgeBaseGraphData.edges.every((edge) => (
  edge.id &&
  nodeIds.has(edge.source) &&
  nodeIds.has(edge.target) &&
  ['prerequisite', 'derivation', 'application'].includes(edge.type)
)));

const teaching = projectTeachingPathGraph(knowledgeBaseGraphData);
assert.deepEqual([...new Set(teaching.nodes.map((node) => node.stageIndex))], [0, 1, 2, 3]);
assert.equal(teaching.stats.orphanCount, 0);
assert.ok(teaching.edges.some((edge) => edge.defaultVisible));
assert.ok(teaching.edges.some((edge) => !edge.defaultVisible));
assert.deepEqual(teaching.stageLanes.map((lane) => lane.nodeCount), [5, 5, 4, 4]);

console.log('knowledge base knowledge graph data tests passed');
