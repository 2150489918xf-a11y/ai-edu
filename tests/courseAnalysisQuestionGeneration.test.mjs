import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
const aiService = readFileSync(new URL('../server/services/aiQuestionService.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/QuestionGeneratePage.vue', import.meta.url), 'utf8');

assert.match(app, /body\.analysisReportId/);
assert.match(app, /courseAnalysisService\.getReportContext/);
assert.match(app, /analysisContext/);
assert.match(aiService, /analysisContext/);
assert.match(aiService, /课程学情报告/);
assert.match(page, /route\.query\.analysisReportId/);
assert.match(page, /fetchCourseAnalysisReportContext/);
assert.match(page, /已引用学情报告/);
assert.match(page, /analysisReportId/);
assert.match(page, /reportWeakPoints/);
assert.match(page, /analysisReportContext\.value \?/);

console.log('course analysis question generation contract passed');
