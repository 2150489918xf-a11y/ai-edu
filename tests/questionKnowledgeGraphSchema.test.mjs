import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const courseService = readFileSync(new URL('../server/services/courseService.js', import.meta.url), 'utf8');
const courseApiClient = readFileSync(new URL('../src/data/courseApiClient.js', import.meta.url), 'utf8');

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

const courseGroupModel = schema.match(/model CourseGroup \{([\s\S]*?)\n\}/)?.[1] || '';
assert.doesNotMatch(
  courseGroupModel,
  /\bknowledgeGraph\b/,
  'course groups must not retain the legacy monolithic knowledge graph JSON'
);

for (const legacyMethod of [
  'getCourseGroupKnowledgeGraph',
  'getCourseGroupKnowledgeGraphContext',
  'saveCourseGroupKnowledgeGraph'
]) {
  assert.ok(!courseService.includes(legacyMethod), `course service must remove ${legacyMethod}`);
}
assert.ok(
  !courseApiClient.includes('CourseGroupKnowledgeGraph'),
  'course API client must remove course-group graph calls'
);

for (const legacyFile of [
  '../server/services/aiKnowledgeGraphService.js',
  '../src/pages/KnowledgeGraphPage.vue',
  './knowledgeGraphIntegration.test.mjs'
]) {
  assert.equal(existsSync(new URL(legacyFile, import.meta.url)), false, `${legacyFile} must be removed`);
}

const questionPointModel = schema.match(/model QuestionKnowledgePoint \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(
  questionPointModel,
  /updatedAt\s+DateTime\s+@default\(now\(\)\)\s+@updatedAt/,
  'existing question-point rows need a safe updatedAt default'
);

console.log('question knowledge graph schema contract passed');
