import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

assert.match(schema, /analysisReports\s+CourseAnalysisReport\[\]/);
assert.match(schema, /model CourseAnalysisReport \{/);
for (const field of ['scopeKey', 'sourceFingerprint', 'sourceAnswerCount', 'sourceQuestionCount', 'summary', 'weakPoints', 'teachingSuggestions', 'practiceSuggestions', 'provider', 'model']) {
  assert.match(schema, new RegExp(`\\b${field}\\b`), `missing ${field}`);
}
assert.match(schema, /@@unique\(\[courseId, scopeKey\]\)/);
assert.match(schema, /@@map\("course_analysis_reports"\)/);

console.log('course analysis schema contract passed');
