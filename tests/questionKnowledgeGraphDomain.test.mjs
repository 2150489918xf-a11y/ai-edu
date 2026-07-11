import assert from 'node:assert/strict';

import {
  buildCoOccurrencePairs,
  buildQuestionContentHash,
  canonicalKnowledgeKey,
  normalizeExtractionPayload,
  normalizeUndirectedPair,
  selectRelationCandidates
} from '../server/services/questionKnowledgeGraphDomain.js';

assert.equal(canonicalKnowledgeKey(' 合 外 力（计算） '), '合外力计算');
assert.equal(canonicalKnowledgeKey('F = ma'), 'fma');

const question = {
  title: 'F=ma',
  options: ['A', 'B'],
  answer: { value: 'A' },
  analysis: '由牛顿第二定律可得',
  knowledge: ['牛顿第二定律']
};
assert.equal(buildQuestionContentHash(question), buildQuestionContentHash({ ...question }));
assert.notEqual(buildQuestionContentHash(question), buildQuestionContentHash({ ...question, title: '求加速度' }));

assert.deepEqual(buildCoOccurrencePairs(['a', 'b', 'c']), [
  ['a', 'b'],
  ['a', 'c'],
  ['b', 'c']
]);
assert.deepEqual(normalizeUndirectedPair('z', 'a'), ['a', 'z']);

const normalized = normalizeExtractionPayload({
  knowledgePoints: [
    { name: '牛二定律', canonicalName: '牛顿第二定律', aliases: ['牛二定律'], confidence: 2 },
    { name: '牛顿第二定律', confidence: 0.8 }
  ],
  relations: [
    { source: '牛顿第二定律', target: '加速度', type: 'derivation', confidence: -1 }
  ]
});
assert.equal(normalized.knowledgePoints.length, 1);
assert.equal(normalized.knowledgePoints[0].canonicalKey, '牛顿第二定律');
assert.equal(normalized.knowledgePoints[0].confidence, 1);
assert.deepEqual(normalized.knowledgePoints[0].aliases, ['牛二定律']);
assert.equal(normalized.relations[0].confidence, 0);

const candidates = selectRelationCandidates(
  { name: '合力', canonicalKey: '合力', aliases: ['合外力'] },
  [
    { id: 'p-acceleration', name: '加速度', canonicalKey: '加速度', aliases: [] },
    { id: 'p-force', name: '合外力', canonicalKey: '合外力', aliases: ['合力'] },
    { id: 'p-mass', name: '质量', canonicalKey: '质量', aliases: [] }
  ],
  2
);
assert.equal(candidates.length, 2);
assert.equal(candidates[0].id, 'p-force');

console.log('question knowledge graph domain tests passed');
