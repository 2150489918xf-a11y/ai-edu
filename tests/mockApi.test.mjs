import assert from 'node:assert/strict';
import { generateMindMap, getKnowledgeBaseMaterials } from '../src/data/mockApi.js';

const result = await getKnowledgeBaseMaterials();

assert.ok(Array.isArray(result.categories), 'categories should be an array');
assert.ok(result.categories.length >= 4, 'knowledge base should expose category filters');
assert.ok(Array.isArray(result.materials), 'materials should be an array');
assert.ok(result.materials.length >= 3, 'knowledge base should expose mock materials');
assert.ok(
  result.materials.some((item) => item.status === 'parsed'),
  'at least one material should be parsed'
);
assert.ok(
  result.materials.some((item) => item.status === 'parsing'),
  'at least one material should be parsing'
);

const mindMapResult = await generateMindMap('math-quadratic');

assert.equal(mindMapResult.courseId, 'math-quadratic', 'mind map result should preserve the course id');
assert.ok(Array.isArray(mindMapResult.steps), 'mind map generation should expose progress steps');
assert.ok(mindMapResult.steps.length >= 4, 'mind map generation should have enough staged steps');
assert.ok(mindMapResult.mindMap, 'mind map generation should return a mind map');
assert.ok(Array.isArray(mindMapResult.mindMap.nodes), 'mind map should expose nodes');
assert.ok(Array.isArray(mindMapResult.mindMap.links), 'mind map should expose links');
assert.ok(
  mindMapResult.mindMap.nodes.some((node) => node.type === 'weak-point'),
  'mind map should include learning weak point nodes'
);

console.log('mockApi knowledge base and mind map contracts passed');
