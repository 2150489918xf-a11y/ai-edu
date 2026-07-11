import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

for (const marker of [
  'graphRevision',
  'canonicalKey',
  'model KnowledgeRelation',
  'model KnowledgeRelationEvidence',
  'model QuestionKnowledgeExtraction',
  'model KnowledgeGraphNodeLayout'
]) {
  assert.ok(schema.includes(marker), `schema should include ${marker}`);
}

assert.match(schema, /bankId\s+String\?/);
assert.match(schema, /manualLocked\s+Boolean/);

const questionPointModel = schema.match(/model QuestionKnowledgePoint \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(
  questionPointModel,
  /updatedAt\s+DateTime\s+@default\(now\(\)\)\s+@updatedAt/,
  'existing question-point rows need a safe updatedAt default'
);

console.log('question knowledge graph schema contract passed');
